import type fr from './fr'

/**
 * Le type `typeof fr` est le verrou : une cle oubliee ou mal orthographiee est
 * une erreur de compilation nommee, pas une chaine manquante decouverte a
 * l'ecran.
 */
const en: typeof fr = {
  app: {
    name: 'Kumo logo studio',
    title: 'Kumo — animated logo studio',
    botAria: 'Animated Kumo logo preview'
  },

  gallery: {
    back: 'Back to the player'
  },

  rail: {
    nav: 'Sections',
    customize: 'Build logo',
    animations: 'Animations',
    settings: 'Settings'
  },

  panel: {
    animations: 'Animation',
    shape: 'Body and legs',
    expression: 'Expression',
    color: 'Colour'
  },

  kumo: {
    design: 'Four-leg composer',
    designHelp: 'Place every leg and give the character its own gesture.',
    variation: 'Surprise me',
    bodyAspect: 'Body proportions',
    round: 'Round',
    tall: 'Taller',
    wide: 'Wider',
    eyeColor: 'Eye colour',
    eye_ink: 'Ink',
    eye_paper: 'Paper',
    eye_cobalt: 'Cobalt',
    eye_ember: 'Ember',
    eye_moss: 'Moss',
    eye_violet: 'Violet',
    eye_amber: 'Amber',
    legLanguage: 'Leg language',
    style_taper: 'Taper',
    style_taperHelp: 'One continuous limb narrowing from shoulder to tip.',
    style_paddle: 'Paddle',
    style_paddleHelp: 'A narrow stem ending in a broad rounded foot.',
    style_knuckle: 'Knuckle',
    style_knuckleHelp: 'One continuous outline, two straight bones and a smoothly rounded elbow—no bulb.',
    stance: 'Stance',
    stanceHelp: 'Start with a gesture',
    stance_scout: 'Scout',
    stance_pounce: 'Pounce',
    stance_orbit: 'Orbit',
    stance_bloom: 'Bloom',
    composerAria: 'Four-leg position editor',
    dragHelp: 'Drag the numbered points around the body to move each leg.',
    legHandle: 'Move leg {number}',
    selectedLeg: 'Leg {number}',
    selectLeg: 'Select a leg to edit',
    legPosition: 'Direction',
    legReach: 'Reach',
    legBend: 'Bend',
    legLength: 'Leg length',
    legThickness: 'Leg thickness',
    motion: 'Leg movement',
    motionHelp: 'Organic baseline movement plus an optional Kumo signature action.',
    animationBreaks: 'Signature break',
    animationBreaksHelp: 'Interrupts the idle',
    rhythm_flow: 'None',
    rhythm_breathe: 'Stretch',
    rhythm_skitter: 'Scuttle',
    rhythm_doze: 'Curl',
    break_flowHelp: 'Keeps the normal four-leg idle without a signature interruption.',
    break_breatheHelp: 'All four legs open into a long stretch, settle, then return to idle.',
    break_skitterHelp: 'Three quick diagonal footfalls ripple through the legs, then clear.',
    break_dozeHelp: 'The legs fold inward, give one sleepy twitch, then slowly unfurl.',
    motionAmount: 'Movement amount',
    motionSpeed: 'Movement speed',
    reset: 'Reset Kumo design'
  },

  export: {
    action: 'Export as PNG',
    more: 'Other formats',
    png: 'Download PNG',
    svg: 'Download SVG',
    anime: 'Download animated SVG',
    gif: 'Download animated GIF',
    embed: 'Copy interactive web component',
    cycleDetail: 'The video is lighter and smoother; the GIF plays anywhere.',
    cycleFormat: 'Format',
    cycle_mp4: 'MP4 video',
    cycle_mp4_aide: 'Light and smooth, needs a background',
    cycle_gif: 'Animated GIF',
    cycle_gif_aide: 'Plays anywhere, heavier',
    cycleProgress: 'Exporting…',
    cycleReessayer: 'Try again',
    gifTitle: 'Download animated GIF',
    gifDetail:
      'GIF transparency is all-or-nothing: with no background, the ball\u2019s edge comes out a little hard.',
    gifBackground: 'Background',
    fond_blanc: 'White background',
    fond_blanc_aide: 'Smooth edge, for light surfaces',
    fond_transparent: 'Transparent background',
    fond_transparent_aide: 'Fits any background, edge a little hard',
    gifConfirm: 'Download',
    copie: 'Copy image',
    copieSvg: 'Copy SVG',
    done: 'Exported',
    copied: 'Copied',
    failed: 'Export failed'
  },

  preview: {
    exit: 'Exit preview',
    key: 'Esc'
  },

  timeline: {
    play: 'Start playback',
    pause: 'Stop playback',
    addAnimation: 'Add an animation',
    preview: 'Preview',
    export: 'Export the montage',
    zoom: 'Track zoom',
    blockAria: '{state}, {duration}',
    blockDurationAria: 'Duration of {state}, {duration}',
    blockRemoveAria: 'Remove {state}'
  },

  dialog: {
    cancel: 'Cancel',
    nameCreateTitle: 'New cycle',
    nameRenameTitle: 'Rename cycle',
    nameField: 'Cycle name',
    nameCreate: 'Create',
    nameRename: 'Rename',
    removeTitle: 'Delete "{name}"?',
    removeDetail:
      'This sequence will be lost, along with its animation. | This sequence will be lost, along with its {n} animations.',
    removeConfirm: 'Delete'
  },

  cycles: {
    defaultName: 'Default cycle',
    newName: 'My cycle',
    menuNew: 'New cycle',
    menuRenameAria: 'Rename {name}',
    menuRemoveAria: 'Delete {name}'
  },

  units: {
    seconds: '{n} s',
    secondsShort: '{n}s'
  },

  settings: {
    title: 'Settings',
    language: 'Language',
    about: 'About',
    credits: 'Made with ❤️ by {name}',
    creditsAria: 'Jérémy on X, in a new tab',
    github: 'View the project on GitHub',
    githubAria: 'The project repository on GitHub, in a new tab'
  },

  states: {
    idle: 'Idle',
    thinking: 'Thinking',
    wink: 'Wink',
    wide: 'Wide eyes',
    alert: 'Alert',
    notify: 'Notification',
    exclaim: 'Exclamation',
    sleep: 'Sleep',
    egg: 'Egg',
    hexagon: 'Hexagon',
    play: 'Play',
    orbit: 'Orbit',
    burst: 'Burst',
    comet: 'Comet',
    swirl: 'Swirl'
  },

  shapes: {
    kumo: 'Custom Kumo',
    cercle: 'Circle',
    galet: 'Pebble',
    squircle: 'Squircle',
    capsule: 'Capsule',
    triangle: 'Triangle',
    hexagone: 'Hexagon',
    nuage: 'Cloud',
    goutte: 'Droplet'
  },

  colors: {
    kumo: 'Kumo grey',
    encre: 'Ink',
    creme: 'Cream',
    brun: 'Brown',
    rouge: 'Red',
    orange: 'Orange',
    ambre: 'Amber',
    vert: 'Green',
    turquoise: 'Turquoise',
    bleu: 'Blue',
    violet: 'Purple',
    rose: 'Pink',
    gris: 'Grey'
  },

  expressions: {
    neutre: 'Neutral',
    attentif: 'Attentive',
    surpris: 'Surprised',
    excite: 'Excited',
    heureux: 'Happy',
    hilare: 'Laughing',
    colere: 'Angry',
    triste: 'Sad',
    effraye: 'Scared',
    mefiant: 'Suspicious',
    confus: 'Confused',
    curieux: 'Curious',
    fier: 'Proud',
    timide: 'Shy',
    blase: 'Unimpressed',
    somnolent: 'Sleepy'
  }
}

export default en
