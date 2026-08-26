Rat Escape v9.3 - Tennis Player Export Fix 2

You do NOT need to change how tennisplayer.blend is saved.

The previous error:
  bpy.ops.object.select_all.poll() failed, context is incorrect
was caused by using a context-dependent Blender selection operator while
Blender was running in background mode (-b).

This package removes that selection step.

Steps:
1. Extract the ZIP.
2. Double-click MAKE_TENNISPLAYER_GLB.bat.
3. Wait for EXPORT COMPLETE.
4. Confirm assets\models\tennisplayer.glb exists.
5. Start the local server and choose Stage 2 / Clubroom.

The garbled Japanese path shown inside some Blender console messages is a
Windows console display issue. Blender already succeeded in reading the
.blend file, so it is not the cause of the export failure.
