import bpy
import os
import sys

RIG_NAME = "TennisPlayer_Rig"
REQUIRED_ACTIONS = {"Idle", "Run"}


def cli_arg(name, default=None):
    if "--" not in sys.argv:
        return default
    args = sys.argv[sys.argv.index("--") + 1:]
    for i, value in enumerate(args):
        if value == name and i + 1 < len(args):
            return args[i + 1]
    return default


def fail(message):
    print("\n[v10.0 EXPORT ERROR] " + message + "\n")
    raise SystemExit(2)


# ------------------------------------------------------------
# Output path
# ------------------------------------------------------------
output = cli_arg("--output")
if not output:
    blend_dir = os.path.dirname(bpy.data.filepath)
    output = os.path.abspath(
        os.path.join(blend_dir, "..", "models", "tennisplayer.glb")
    )
else:
    output = os.path.abspath(output)

os.makedirs(os.path.dirname(output), exist_ok=True)


# ------------------------------------------------------------
# Validate the saved character
# ------------------------------------------------------------
rig = bpy.data.objects.get(RIG_NAME)
if rig is None or rig.type != "ARMATURE":
    fail("Armature 'TennisPlayer_Rig' was not found in the .blend file.")

found_actions = {action.name for action in bpy.data.actions}
missing = REQUIRED_ACTIONS - found_actions
if missing:
    fail("Missing required actions: " + ", ".join(sorted(missing)))

# Keep both animation tracks enabled.  This uses Blender's data API only;
# no View3D/object-selection context is required in background mode.
rig.animation_data_create()
rig.animation_data.action = None
for track in rig.animation_data.nla_tracks:
    if track.name in REQUIRED_ACTIONS:
        track.mute = False

scene = bpy.context.scene
if scene is None:
    fail("No active scene was found.")
scene.frame_set(1)


# ------------------------------------------------------------
# Export
#
# IMPORTANT:
# Do NOT call bpy.ops.object.select_all/select_set here.
# Those operators can fail when Blender is launched with -b (background
# mode), which is exactly what happened in the previous v9.3 exporter.
# The source .blend contains the tennis-player asset, so export the scene
# directly and exclude cameras/lights.
# ------------------------------------------------------------
try:
    operator_props = set(
        bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    )
except Exception as exc:
    fail("glTF exporter is unavailable: " + repr(exc))

kwargs = {
    "filepath": output,
    "export_format": "GLB",
    "export_animations": True,
    "export_skins": True,
    "export_morph": True,
    "export_yup": True,
    "export_cameras": False,
    "export_lights": False,
    "use_selection": False,
}

# Add only options that exist in the installed Blender version.
optional = {
    # Blender 4.x can export each Action as a separate animation.
    "export_animation_mode": "ACTIONS",
    # Older/newer exporter variants may use NLA strips for named clips.
    "export_nla_strips": True,
    "export_anim_single_armature": True,
    "export_reset_pose_bones": True,
    "export_force_sampling": True,
    "export_frame_range": False,
    "export_anim_slide_to_zero": True,
    "export_optimize_animation_size": True,
    "export_optimize_animation_keep_anim_armature": True,
}

for key, value in optional.items():
    if key in operator_props:
        kwargs[key] = value

# Keep compatibility across Blender versions.
kwargs = {key: value for key, value in kwargs.items() if key in operator_props}

print("\n============================================")
print("Rat Escape v10.0 - tennisplayer.glb export")
print("============================================")
print("Blend   :", bpy.data.filepath)
print("Rig     :", rig.name)
print("Actions :", sorted(found_actions & REQUIRED_ACTIONS))
print("Output  :", output)
print("Mode    : background-safe scene export")
print("============================================\n")

try:
    result = bpy.ops.export_scene.gltf(**kwargs)
except Exception as exc:
    fail("glTF export operator failed: " + repr(exc))

if "FINISHED" not in result:
    fail("glTF exporter did not finish successfully: " + repr(result))

if not os.path.exists(output):
    fail("tennisplayer.glb was not created.")

if os.path.getsize(output) < 1000:
    fail("tennisplayer.glb is unexpectedly small.")

print("\n[v10.0 EXPORT OK]")
print(output)
print("size =", os.path.getsize(output), "bytes")
print("Expected animation clips: Idle / Run")
print()
