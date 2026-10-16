"""Extract the Radiola TV, without the chairs or frame-sequence screens.

blender --background --python scripts/export-construct-tv.py -- \
  --source the-matrix-white-room.zip --output public/models/construct-tv.glb

The source ZIP and its .blend are never modified. Blender 4.5+ is required.
"""

import argparse
import os
import sys
import tempfile
import zipfile

import bpy


def options():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="Original supplied ZIP")
    parser.add_argument("--output", required=True, help="Destination .glb")
    return parser.parse_args(args)


def main():
    args = options()
    with tempfile.TemporaryDirectory(prefix="tvm-construct-") as temporary:
        with zipfile.ZipFile(args.source) as archive:
            name = next(
                (entry for entry in archive.namelist() if entry.endswith(".blend")),
                None,
            )
            if name is None:
                raise ValueError("The source ZIP contains no Blender scene.")
            blend = os.path.join(temporary, "construct.blend")
            with archive.open(name) as source, open(blend, "wb") as target:
                while chunk := source.read(1024 * 1024):
                    target.write(chunk)
        bpy.ops.wm.open_mainfile(filepath=blend)

        tv = bpy.data.objects["TV"]
        screen = bpy.data.objects["TV Screen.001"]
        case = bpy.data.objects["TV Case"]
        included = {tv, *tv.children_recursive, case, screen}
        meshes = [obj for obj in included if obj.type == "MESH"]
        if len(meshes) != 27:
            raise ValueError(f"Expected 27 TV meshes, found {len(meshes)}")

        # The source has 200 overlapping still-frame meshes. Ship exactly one
        # screen, with ordinary UVs and an untextured placeholder for live video.
        screen.name = "PlaybackScreen"
        mesh = screen.data
        uvs = mesh.uv_layers.active.data
        xs = [vertex.co.x for vertex in mesh.vertices]
        zs = [vertex.co.z for vertex in mesh.vertices]
        for polygon in mesh.polygons:
            for loop_index in polygon.loop_indices:
                vertex = mesh.vertices[mesh.loops[loop_index].vertex_index].co
                uvs[loop_index].uv = (
                    (vertex.x - min(xs)) / (max(xs) - min(xs)),
                    (vertex.z - min(zs)) / (max(zs) - min(zs)),
                )
        mesh.materials.clear()
        placeholder = bpy.data.materials.new("Playback screen placeholder")
        placeholder.diffuse_color = (0.015, 0.015, 0.015, 1)
        mesh.materials.append(placeholder)

        # The source includes two identical copies of this normal image. Share
        # one datablock so the export does not upload the same map twice.
        normal = bpy.data.images["Radiola_normal.png"]
        for obj in meshes:
            for material in obj.data.materials:
                if not material or not material.node_tree:
                    continue
                for node in material.node_tree.nodes:
                    if (
                        node.type == "TEX_IMAGE"
                        and node.image
                        and node.image.name == "Radiola_normal.png.001"
                    ):
                        node.image = normal

        # Only textures referenced by the selected TV meshes can reach the GLB.
        images = {
            node.image
            for obj in meshes
            for material in obj.data.materials
            if material and material.use_nodes and material.node_tree
            for node in material.node_tree.nodes
            if node.type == "TEX_IMAGE" and node.image
        }
        for image in images:
            width, height = image.size
            if max(width, height) > 1024:
                ratio = 1024 / max(width, height)
                image.scale(round(width * ratio), round(height * ratio))
                image.pack()

        bpy.ops.object.select_all(action="DESELECT")
        for obj in included:
            obj.hide_set(False)
            obj.select_set(True)
        bpy.context.view_layer.objects.active = screen
        output = os.path.abspath(args.output)
        os.makedirs(os.path.dirname(output), exist_ok=True)
        result = bpy.ops.export_scene.gltf(
            filepath=output,
            export_format="GLB",
            use_selection=True,
            export_animations=False,
            export_materials="EXPORT",
            export_image_format="AUTO",
            export_yup=True,
            export_cameras=False,
            export_lights=False,
            export_extras=False,
        )
        if result != {"FINISHED"}:
            raise RuntimeError(f"Blender export failed: {result}")
        hd_color = os.path.join(os.path.dirname(output), "construct-tv-color-2k.jpg")
        with zipfile.ZipFile(args.source) as archive:
            with archive.open("textures/Radiola_baseColor.jpeg") as source:
                with open(hd_color, "wb") as target:
                    while chunk := source.read(1024 * 1024):
                        target.write(chunk)
        print(f"Exported {len(meshes)} TV meshes and {len(images)} images: {output}")
        print(f"Optional full-resolution TV color atlas: {hd_color}")


if __name__ == "__main__":
    main()
