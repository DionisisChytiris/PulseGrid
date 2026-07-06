export type { CompiledPlaybackMetadata, CompiledPlaybackSequence } from './CompiledPlaybackSequence';
export { createCompiledPlaybackSequence } from './CompiledPlaybackSequence';
export type { PlaybackEvent, PlaybackEventSource } from './PlaybackEvent';
export {
  compileSong,
  DEFAULT_COMPILE_BPM,
  expandBarToEvents,
  flattenToEventStream,
  resolveTempoAtPosition,
  type BarCompileContext,
  type CompileSongOptions,
} from './SongPlaybackCompiler';
