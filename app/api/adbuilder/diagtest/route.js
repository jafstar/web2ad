import { execFile } from 'child_process'
import { promisify } from 'util'
const execFileAsync = promisify(execFile)

// Temporary diagnostic - isolates whether Vercel's Linux Lambda corrupts a
// long single execFile argv element containing a repeated substring,
// independent of ffmpeg entirely. Delete once the real ffmpeg corruption
// bug is understood.
export async function GET() {
  const testArg = `[0:v]scale=1280:1280,zoompan=z='min(zoom+0.0015,1.15)':d=125:s=1280x1280:fps=25,scale=1024:1024,setsar=1[v];` +
    `[2:a]volume=0.35,afade=t=out:st=4.4:d=0.6[music];` +
    `[1:a]afade=t=out:st=4.4:d=0.6[narr];` +
    `[narr][music]amix=inputs=2:duration=first:dropout_transition=0[a]`

  const { stdout } = await execFileAsync(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', testArg])

  // Second test: does execFile's own "Command failed" error-message
  // reconstruction (only built on a non-zero exit) preserve the arg
  // correctly? This is a genuinely different code path than a successful
  // spawn - echo the arg back then exit(1) to force that path.
  let errorMessage = null
  try {
    await execFileAsync(process.execPath, ['-e', 'process.stdout.write(process.argv[1]); process.exit(1)', testArg])
  } catch (e) {
    errorMessage = e.message
  }

  return Response.json({
    sentLength: testArg.length,
    receivedLength: stdout.length,
    sent: testArg,
    received: stdout,
    match: testArg === stdout,
    errorMessage,
    errorMessageContainsFullArg: errorMessage?.includes(testArg),
  })
}
