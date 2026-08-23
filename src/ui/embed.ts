import {
  normalizeKumoDesign,
  normalizeKumoMotion,
  type KumoDesign,
  type KumoMotion
} from '@/bot/kumo'
import { EXPRESSION_BY_ID, DEFAULT_EXPRESSION } from '@/bot/expressions'

export const KUMO_EMBED_MODULE = 'https://kumo-logo-studio.vercel.app/embed/kumo-logo.js'

export interface KumoEmbedOptions {
  color: string
  expression: string
  design: KumoDesign
  motion: KumoMotion
}

/**
 * A paste-ready live component, rather than a recording. The serialized design
 * is the user's current mark; all future motion is produced on the destination
 * site by the same deterministic Kumo engine as the studio.
 */
export function kumoEmbedSnippet(options: KumoEmbedOptions) {
  const config = {
    color: /^#[0-9a-f]{6}$/i.test(options.color) ? options.color.toLowerCase() : '#d9d9d9',
    expression: EXPRESSION_BY_ID.has(options.expression) ? options.expression : DEFAULT_EXPRESSION,
    design: normalizeKumoDesign(options.design),
    motion: normalizeKumoMotion(options.motion),
    followPointer: true
  }
  // A literal "</script" must never be able to terminate the module block.
  const json = JSON.stringify(config, null, 2).replaceAll('<', '\\u003c')

  return `<!-- Interactive Kumo: autonomous eyes, articulated legs, and context gestures -->
<kumo-logo id="kumo-logo" aria-label="Kumo" style="width: min(280px, 100%);"></kumo-logo>
<script type="module">
  import "${KUMO_EMBED_MODULE}";

  const kumo = document.querySelector("#kumo-logo");
  kumo.configure(${json});

  // Drive Kumo from your app whenever the situation changes:
  // kumo.setContext("loading");
  // kumo.setContext("success");
  // kumo.setContext("error");
  // kumo.lookAt(0.6, -0.2);       // normalized x/y, each from -1 to 1
  // kumo.setExpression("curious");
  // kumo.playBreak("scuttle");   // stretch | scuttle | curl
  // console.log(kumo.getConfig()); // inspect every normalized design setting
  // kumo.resumeIdle();
</script>`
}
