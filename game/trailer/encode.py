import sys, subprocess, imageio_ffmpeg
ff = imageio_ffmpeg.get_ffmpeg_exe()
frames, wav, out = sys.argv[1], sys.argv[2], sys.argv[3]
dur = sys.argv[4] if len(sys.argv) > 4 else '19.8'
cmd = [ff, '-y', '-framerate', '60', '-i', f'{frames}/%05d.jpg', '-i', wav, '-t', dur,
       '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-maxrate', '6M', '-bufsize', '12M', '-profile:v', 'high', '-r', '60',
       '-c:a', 'aac', '-b:a', '256k', '-ar', '44100', '-movflags', '+faststart', '-shortest', out]
print(' '.join(cmd)); subprocess.run(cmd, check=True)
