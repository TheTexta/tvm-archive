"use client";

import { useEffect, useRef } from "react";
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  VSMShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  ShadowMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
  VideoTexture,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { ScreenLighting } from "@/lib/screen-lighting";
import { configureMaterialLightProcessing } from "@/lib/material-light-processing";
import {
  crtFragmentShader,
  crtRaster,
  crtVertexShader,
} from "@/lib/crt-screen";
import {
  canTrialAfterBaseline,
  canTrialTextureDetail,
  defaultToEnhancedDetail,
  enhancedDetailIsSmooth,
  p90FrameTime,
} from "@/lib/scene-quality";

// Avoid retrying a failed desktop upgrade on every shuffle within this tab.
let desktopDetailRejected = false;
let crtRejected = false;
let screenLightRejected = false;

export default function TVScene({
  video,
  onReady,
  onError,
}: {
  video: HTMLVideoElement;
  onReady: () => void;
  onError: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = container.current;
    if (!mount) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      onError();
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = VSMShadowMap;
    renderer.shadowMap.autoUpdate = false;
    const contextLost = (event: Event) => {
      event.preventDefault();
      onError();
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    mount.appendChild(renderer.domElement);

    const scene = new Scene();
    const referenceLightProcessing =
      new URLSearchParams(window.location.search).get("lightProcessing") !==
      "original";
    mount.dataset.lightProcessing = referenceLightProcessing
      ? "meta-crt"
      : "original";
    scene.background = new Color(0xfafaf9);
    scene.fog = new Fog(0xfafaf9, 12, 80);
    const camera = new PerspectiveCamera(35, 1, 0.1, 100);
    camera.name = "Television camera";
    camera.position.set(0, 0.3, 6.6);
    camera.lookAt(0, 0.05, 0);
    scene.add(new AmbientLight(0xffffff, 2.8));
    const key = new DirectionalLight(0xfff8ed, 4.4);
    key.name = "Studio key light";
    // Looking toward -Z, the camera's right is world +X.
    key.position.set(3, 7, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 15;
    key.shadow.bias = -0.00015;
    key.shadow.radius = 8;
    key.shadow.blurSamples = 8;
    scene.add(key);
    const rim = new DirectionalLight(0xffffff, 1.5);
    rim.position.set(-3, 1, -2);
    scene.add(rim);

    // A continuous white studio floor fades into a matching background. There
    // is no wall seam or finite floor edge to interrupt the distant view.
    const room = new Group();
    room.name = "White room";
    const floor = new Mesh(
      new PlaneGeometry(200, 200),
      new MeshBasicMaterial({ color: 0xfafaf9 }),
    );
    floor.name = "Infinite-look floor";
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.1;
    room.add(floor);
    const shadow = new Mesh(
      new PlaneGeometry(8, 8),
      new ShadowMaterial({ color: 0x55514b, opacity: 0.08 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.09;
    shadow.receiveShadow = true;
    room.add(shadow);
    scene.add(room);

    const texture = new VideoTexture(video);
    texture.colorSpace = SRGBColorSpace;
    texture.flipY = false;

    // The source's 200 still-frame meshes are replaced by one dedicated plane.
    // Keep each recording's natural proportions inside the Radiola CRT aperture.
    const aspect = { value: 4 / 3 };
    const raster = { value: new Vector2(320, 240) };
    const crt = { value: 0 };
    const updateAspect = () => {
      aspect.value =
        video.videoWidth && video.videoHeight
          ? video.videoWidth / video.videoHeight
          : 4 / 3;
      raster.value.set(...crtRaster(video.videoWidth, video.videoHeight));
    };
    video.addEventListener("loadedmetadata", updateAspect);
    updateAspect();
    const screenMaterial = new ShaderMaterial({
      uniforms: {
        tvVideo: { value: texture },
        tvAspect: aspect,
        tvRaster: raster,
        tvCrt: crt,
      },
      vertexShader: crtVertexShader,
      fragmentShader: crtFragmentShader,
      toneMapped: false,
    });
    let active = true;
    let model: Group | undefined;
    let modelReady = false;
    let screenLighting: ScreenLighting | null = null;
    let lightingGeneration = 0;
    let lightingTask: Promise<void> | null = null;
    let playbackScreen: Mesh | null = null;
    const lightFrames: number[] = [];
    let lightWarmup = 20;
    let frame = 0;
    let visible = true;
    let baseDistance = 6.6;
    const pointer = { x: 0, y: 0 };
    const target = new Vector3();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const navigatorHints = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
    const hardware = () => ({
      width: mount.clientWidth,
      height: mount.clientHeight,
      pixelRatio: window.devicePixelRatio,
      saveData: navigatorHints.connection?.saveData,
      deviceMemory: navigatorHints.deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
    });
    let quality: "basic" | "loading" | "trial" | "enhanced" | "rejected" =
      "basic";
    mount.dataset.graphics = quality;
    let generation = 0;
    let highResolutionColor: Texture | null = null;
    const originalColorMaps = new Map<MeshStandardMaterial, Texture>();
    const textureFilters = new Map<Texture, number>();
    const baselineFrames: number[] = [];
    const enhancedFrames: number[] = [];
    let baselineP90 = 0;
    let warmupFrames = 0;
    let previousFrame = 0;
    const crtFrames: number[] = [];
    let crtWarmup = 20;
    const updateCrt = () => {
      crt.value = !crtRejected && canTrialTextureDetail(hardware()) ? 1 : 0;
      mount.dataset.crt = crt.value ? "lottes" : "off";
      crtFrames.length = 0;
      crtWarmup = 20;
    };
    mount.dataset.screenLight = "off";
    const requestedLighting = new URLSearchParams(window.location.search).get(
      "screenLight",
    );
    const stopScreenLighting = () => {
      lightingGeneration++;
      lightingTask = null;
      screenLighting?.dispose();
      screenLighting = null;
      lightFrames.length = 0;
      crtFrames.length = 0;
      crtWarmup = 20;
      mount.dataset.screenLight = "off";
      delete mount.dataset.screenRays;
    };
    const canLightScreen = () =>
      requestedLighting !== "off" &&
      !screenLightRejected &&
      canTrialTextureDetail(hardware());
    const syncScreenLighting = (): Promise<void> => {
      if (!canLightScreen()) {
        stopScreenLighting();
        return Promise.resolve();
      }
      if (!modelReady || screenLighting) return Promise.resolve();
      if (lightingTask) return lightingTask;
      const currentGeneration = ++lightingGeneration;
      const factory =
        requestedLighting === "raytrace"
          ? import("@/lib/bezel-ray-lighting").then(
              (module) => module.createBezelRayLighting,
            )
          : import("@/lib/screen-lighting").then(
              (module) => module.createScreenLighting,
            );
      const task = factory
        .then((createScreenLighting) => {
          if (
            !active ||
            currentGeneration !== lightingGeneration ||
            !canLightScreen() ||
            !model ||
            !playbackScreen
          )
            return;
          screenLighting = createScreenLighting(
            model,
            playbackScreen,
            video,
            (original, clone) => {
              // A newly cloned bezel can already carry the optional 2K atlas.
              // Register its baseline too, so atlas downgrade never leaves it
              // referencing a disposed high-resolution texture.
              const baseline = originalColorMaps.get(original);
              if (baseline) originalColorMaps.set(clone, baseline);
              return () => {
                originalColorMaps.delete(clone);
              };
            },
          );
          if (!screenLighting) {
            screenLightRejected = true;
            return;
          }
          lightFrames.length = 0;
          lightWarmup = 20;
          crtFrames.length = 0;
          previousFrame = 0;
          mount.dataset.screenLight = screenLighting.mode;
          if (screenLighting.raySamples)
            mount.dataset.screenRays = String(screenLighting.raySamples);
          refresh();
        })
        .catch(() => {
          if (active && currentGeneration === lightingGeneration) {
            screenLightRejected = true;
            stopScreenLighting();
          }
        })
        .finally(() => {
          if (lightingTask === task) lightingTask = null;
        });
      lightingTask = task;
      return task;
    };
    let previousWidth = 0;
    let previousHeight = 0;
    let desktopView = false;
    const setQuality = (next: typeof quality) => {
      quality = next;
      mount.dataset.graphics = next;
    };
    const restoreTextureFiltering = () => {
      textureFilters.forEach((anisotropy, map) => {
        map.anisotropy = anisotropy;
        map.needsUpdate = true;
      });
      textureFilters.clear();
    };
    const discardDetail = () => {
      generation++;
      originalColorMaps.forEach((map, material) => {
        material.map = map;
        material.needsUpdate = true;
      });
      originalColorMaps.clear();
      restoreTextureFiltering();
      highResolutionColor?.dispose();
      highResolutionColor = null;
    };
    const rejectDetail = () => {
      if (desktopView && baselineP90 === 0) desktopDetailRejected = true;
      discardDetail();
      setQuality("rejected");
      enhancedFrames.length = 0;
    };
    const enhanceTextureFiltering = () => {
      const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
      if (anisotropy < 2) return;
      model?.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        const materials = Array.isArray(node.material)
          ? node.material
          : [node.material];
        materials.forEach((material) => {
          if (!(material instanceof MeshStandardMaterial)) return;
          for (const map of [
            material.map,
            material.normalMap,
            material.roughnessMap,
            material.metalnessMap,
            material.aoMap,
          ]) {
            if (!map || textureFilters.has(map)) continue;
            textureFilters.set(map, map.anisotropy);
            map.anisotropy = anisotropy;
            map.needsUpdate = true;
          }
        });
      });
    };
    const applyHighResolutionColor = (color: Texture) => {
      const materials = new Set<MeshStandardMaterial>();
      model?.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        const assigned = Array.isArray(node.material)
          ? node.material
          : [node.material];
        assigned.forEach((material) => {
          if (
            material instanceof MeshStandardMaterial &&
            (material.name === "Radiola" || material.name === "Radiola.001") &&
            material.map
          )
            materials.add(material);
        });
      });
      const source = materials.values().next().value?.map;
      if (!source) return false;
      color.flipY = source.flipY;
      color.colorSpace = source.colorSpace;
      color.wrapS = source.wrapS;
      color.wrapT = source.wrapT;
      color.minFilter = source.minFilter;
      color.magFilter = source.magFilter;
      color.repeat.copy(source.repeat);
      color.offset.copy(source.offset);
      color.center.copy(source.center);
      color.rotation = source.rotation;
      color.channel = source.channel;
      color.needsUpdate = true;
      materials.forEach((material) => {
        if (!material.map) return;
        originalColorMaps.set(material, material.map);
        material.map = color;
        material.needsUpdate = true;
      });
      highResolutionColor = color;
      return true;
    };
    const tryTextureDetail = async (desktopDefault = false) => {
      setQuality("loading");
      const currentGeneration = ++generation;
      let color: Texture | null = null;
      try {
        color = await new TextureLoader().loadAsync(
          "/models/construct-tv-color-2k.jpg",
        );
        if (!active || currentGeneration !== generation) {
          color.dispose();
          return;
        }
        if (!visible || document.hidden || (!desktopDefault && video.paused)) {
          color.dispose();
          baselineFrames.length = 0;
          setQuality("basic");
          return;
        }
        if (!applyHighResolutionColor(color)) {
          color.dispose();
          rejectDetail();
          return;
        }
        color = null;
        enhanceTextureFiltering();
        enhancedFrames.length = 0;
        warmupFrames = 20;
        if (desktopDefault) baselineP90 = 0;
        setQuality(desktopDefault ? "enhanced" : "trial");
      } catch {
        color?.dispose();
        if (active && currentGeneration === generation) rejectDetail();
      }
    };
    const measureFrame = (now: number) => {
      if (video.paused || video.ended) {
        previousFrame = 0;
        return;
      }
      const elapsed = previousFrame ? now - previousFrame : 0;
      previousFrame = now;
      if (screenLighting && elapsed >= 5 && elapsed < 1000) {
        if (lightWarmup > 0) lightWarmup--;
        else {
          lightFrames.push(elapsed);
          if (lightFrames.length >= 90) {
            if ((p90FrameTime(lightFrames) ?? 0) > 24) {
              if (screenLighting.reduceQuality?.()) {
                lightWarmup = 20;
                mount.dataset.screenRays = String(screenLighting.raySamples);
              } else {
                screenLightRejected = true;
                stopScreenLighting();
              }
            }
            lightFrames.length = 0;
          }
        }
      }
      // Independently guard the screen effect, including on the basic atlas.
      // Remove optional area lighting first before judging CRT performance.
      if (crt.value && !screenLighting && elapsed >= 5 && elapsed < 1000) {
        if (crtWarmup > 0) crtWarmup--;
        else {
          crtFrames.push(elapsed);
          if (crtFrames.length >= 90) {
            if ((p90FrameTime(crtFrames) ?? 0) > 24) {
              crtRejected = true;
              updateCrt();
            }
            crtFrames.length = 0;
          }
        }
      }
      if (elapsed < 5 || elapsed > 100) return;
      if (quality === "basic") {
        if (desktopView && desktopDetailRejected) {
          setQuality("rejected");
          return;
        }
        baselineFrames.push(elapsed);
        if (baselineFrames.length < 90) return;
        if (
          !model ||
          !canTrialTextureDetail(hardware()) ||
          !canTrialAfterBaseline(baselineFrames)
        ) {
          setQuality("rejected");
          return;
        }
        baselineP90 = p90FrameTime(baselineFrames) ?? 20;
        void tryTextureDetail();
      } else if (quality === "trial" || quality === "enhanced") {
        if (warmupFrames > 0) {
          warmupFrames--;
          return;
        }
        enhancedFrames.push(elapsed);
        if (enhancedFrames.length < 90) return;
        const smooth = baselineP90
          ? enhancedDetailIsSmooth(baselineP90, enhancedFrames)
          : canTrialAfterBaseline(enhancedFrames);
        enhancedFrames.length = 0;
        if (!smooth) rejectDetail();
        else if (quality === "trial") setQuality("enhanced");
      }
    };
    const render = (now: number) => {
      frame = 0;
      if (!active || !visible || document.hidden) return;
      target.set(
        -pointer.x * (mount.clientWidth < 640 ? 0.2 : 0.7),
        0.3 + pointer.y * 0.35,
        baseDistance,
      );
      if (reducedMotion.matches) camera.position.copy(target);
      else camera.position.lerp(target, 0.06);
      camera.lookAt(0, 0.05, 0);
      if (screenLighting && !screenLighting.update(now)) {
        screenLightRejected = true;
        stopScreenLighting();
      }
      renderer.render(scene, camera);
      measureFrame(now);
      if (
        (!video.paused && !video.ended) ||
        screenLighting?.settling ||
        camera.position.distanceToSquared(target) > 0.00001
      )
        frame = requestAnimationFrame(render);
    };
    const refresh = () => {
      if (model && !frame) frame = requestAnimationFrame(render);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (
        !finePointer.matches ||
        reducedMotion.matches ||
        event.pointerType === "touch"
      )
        return;
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
      refresh();
    };
    const onMotionChange = () => {
      pointer.x = 0;
      pointer.y = 0;
      previousWidth = 0;
      resize();
      refresh();
    };
    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (
        !width ||
        !height ||
        (width === previousWidth && height === previousHeight)
      )
        return;
      previousWidth = width;
      previousHeight = height;
      const wasDesktop = desktopView;
      desktopView = defaultToEnhancedDetail(hardware(), finePointer.matches);
      updateCrt();
      void syncScreenLighting();
      lightFrames.length = 0;
      lightWarmup = 20;
      previousFrame = 0;
      baselineFrames.length = 0;
      if (quality === "loading") {
        if (!desktopView || wasDesktop !== desktopView) {
          generation++;
          setQuality("basic");
        }
      } else if (quality === "trial" || quality === "enhanced") {
        if (desktopView && desktopDetailRejected) {
          discardDetail();
          setQuality("rejected");
        } else if (wasDesktop && !desktopView) {
          discardDetail();
          setQuality("basic");
          baselineP90 = 0;
        } else if (!desktopView && !canTrialTextureDetail(hardware())) {
          rejectDetail();
        } else {
          enhancedFrames.length = 0;
          warmupFrames = 20;
          if (desktopView) baselineP90 = 0;
          setQuality(desktopView ? "enhanced" : "trial");
        }
      } else if (quality === "rejected" && wasDesktop && !desktopView) {
        setQuality("basic");
      }
      const aspect = width / height;
      baseDistance = Math.max(
        6.6,
        1 + 1.3 / (Math.tan((camera.fov * Math.PI) / 360) * aspect),
        height < 700 ? 11.3 : 0,
      );
      if (!model) camera.position.set(0, 0.3, baseDistance);
      camera.lookAt(0, 0.05, 0);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      if (
        quality === "basic" &&
        desktopView &&
        !desktopDetailRejected &&
        modelReady &&
        visible
      )
        void tryTextureDetail(true);
      refresh();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) {
        previousFrame = 0;
        crtFrames.length = 0;
        crtWarmup = 20;
        lightFrames.length = 0;
        lightWarmup = 20;
        enhancedFrames.length = 0;
        warmupFrames = 20;
      } else if (
        modelReady &&
        desktopView &&
        !desktopDetailRejected &&
        quality === "basic"
      ) {
        void tryTextureDetail(true);
      }
      refresh();
    });
    intersection.observe(mount);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    reducedMotion.addEventListener("change", onMotionChange);
    finePointer.addEventListener("change", onMotionChange);
    video.addEventListener("playing", refresh);
    video.addEventListener("pause", refresh);
    video.addEventListener("seeked", refresh);
    const onVisibilityChange = () => {
      if (document.hidden) {
        previousFrame = 0;
        crtFrames.length = 0;
        crtWarmup = 20;
        lightFrames.length = 0;
        lightWarmup = 20;
      }
      refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    resize();

    const initiallyEnhanced = desktopView && !desktopDetailRejected;
    if (desktopView && desktopDetailRejected) setQuality("rejected");
    const initialGeneration = initiallyEnhanced ? ++generation : generation;
    if (initiallyEnhanced) setQuality("loading");
    let loadFailed = false;
    let initialColor: Texture | null = null;
    const colorPromise: Promise<Texture | null> = initiallyEnhanced
      ? new TextureLoader()
          .loadAsync("/models/construct-tv-color-2k.jpg")
          .then((color) => {
            initialColor = color;
            if (!active || loadFailed) {
              color.dispose();
              return null;
            }
            return color;
          })
          .catch(() => null)
      : Promise.resolve(null);
    void Promise.all([
      new GLTFLoader().loadAsync("/models/construct-tv.glb"),
      colorPromise,
    ])
      .then(async ([gltf, color]) => {
        if (!active) {
          color?.dispose();
          return;
        }
        const loaded = gltf.scene;
        const screen = loaded.getObjectByName("PlaybackScreen");
        if (!(screen instanceof Mesh)) {
          color?.dispose();
          onError();
          return;
        }
        model = loaded;
        playbackScreen = screen;
        loaded.name = "Construct Radiola";
        const bounds = new Box3().setFromObject(loaded);
        const center = bounds.getCenter(new Vector3());
        const scale = 2.15 / bounds.getSize(new Vector3()).y;
        loaded.scale.setScalar(scale);
        loaded.position.copy(center).multiplyScalar(-scale);
        const pbrMaterials = new Set<MeshStandardMaterial>();
        loaded.traverse((node) => {
          if (!(node instanceof Mesh)) return;
          node.castShadow = node !== screen;
          const materials = Array.isArray(node.material)
            ? node.material
            : [node.material];
          materials.forEach((material) => {
            if (node !== screen && material instanceof MeshStandardMaterial)
              pbrMaterials.add(material);
          });
        });
        if (referenceLightProcessing)
          pbrMaterials.forEach(configureMaterialLightProcessing);
        const oldMaterial = screen.material;
        screen.material = screenMaterial;
        if (Array.isArray(oldMaterial))
          oldMaterial.forEach((material) => material.dispose());
        else oldMaterial.dispose();

        if (
          color &&
          initiallyEnhanced &&
          initialGeneration === generation &&
          desktopView &&
          applyHighResolutionColor(color)
        ) {
          initialColor = null;
          enhanceTextureFiltering();
          warmupFrames = 20;
          baselineP90 = 0;
          setQuality("enhanced");
        } else {
          color?.dispose();
          initialColor = null;
          if (initiallyEnhanced && quality === "loading") {
            if (!color) desktopDetailRejected = true;
            setQuality(color ? "basic" : "rejected");
          }
        }

        scene.add(loaded);
        modelReady = true;
        await syncScreenLighting();
        if (!active) return;
        renderer.shadowMap.needsUpdate = true;
        onReady();
        refresh();
      })
      .catch(() => {
        loadFailed = true;
        initialColor?.dispose();
        if (active) onError();
      });

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      reducedMotion.removeEventListener("change", onMotionChange);
      finePointer.removeEventListener("change", onMotionChange);
      video.removeEventListener("playing", refresh);
      video.removeEventListener("pause", refresh);
      video.removeEventListener("seeked", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      video.removeEventListener("loadedmetadata", updateAspect);
      discardDetail();
      stopScreenLighting();
      texture.dispose();
      const maps = new Set<Texture>();
      model?.traverse((node) => {
        if (node instanceof Mesh) {
          node.geometry.dispose();
          const materials = Array.isArray(node.material)
            ? node.material
            : [node.material];
          materials.forEach((material) => {
            if (material instanceof MeshStandardMaterial) {
              for (const map of [
                material.map,
                material.normalMap,
                material.bumpMap,
                material.metalnessMap,
                material.roughnessMap,
                material.aoMap,
              ]) {
                if (map) maps.add(map);
              }
            }
            material.dispose();
          });
        }
      });
      maps.forEach((map) => map.dispose());
      screenMaterial.dispose();
      room.traverse((node) => {
        if (node instanceof Mesh) {
          node.geometry.dispose();
          if (Array.isArray(node.material))
            node.material.forEach((material) => material.dispose());
          else node.material.dispose();
        }
      });
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [video, onReady, onError]);

  return (
    <div ref={container} className="absolute inset-0" aria-hidden="true" />
  );
}
