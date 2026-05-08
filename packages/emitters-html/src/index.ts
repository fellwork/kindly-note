// @kindly-note/emitters-html — public exports.
// spec §1.2 row "@kindly-note/emitters-html" defines the public surface.

export {
  DEFAULT_CLASS_PREFIX,
  htmlEmitter,
  htmlEmitterWith,
  type HtmlEmitterConfig,
} from './emitter.js';

// Internal helpers re-exported for downstream emitters (e.g. emitters-hast can
// reuse the scope-to-class logic). Stable names; spec §6.3 exports map could
// promote these to subpaths in a later cohort if other packages start
// depending on them.
export { htmlEscape } from './escape.js';
export { toClassNames } from './scope-to-class.js';
