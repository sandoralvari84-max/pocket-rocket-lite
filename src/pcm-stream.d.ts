// The @fugood/react-native-audio-pcm-stream package ships its types under the original upstream
// module name ("react-native-live-audio-stream"), so TypeScript can't resolve types for the
// scoped import path (it resolves fine at runtime). Declare the scoped path here.
declare module "@fugood/react-native-audio-pcm-stream" {
  export interface Options {
    sampleRate: number;
    channels: number;      // 1 | 2
    bitsPerSample: number; // 8 | 16
    audioSource?: number;  // Android audio source (6 = VOICE_RECOGNITION)
    wavFile: string;
    bufferSize?: number;
  }
  interface IAudioRecord {
    init: (options: Options) => void;
    start: () => void;
    stop: () => Promise<string>; // resolves to the recorded WAV file path
    on: (event: "data", callback: (data: string) => void) => void;
  }
  const AudioRecord: IAudioRecord;
  export default AudioRecord;
}
