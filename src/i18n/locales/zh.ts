import type fr from './fr'

/**
 * Chinois simplifie. Trois differences typographiques portees par la traduction
 * et pas par le code :
 *
 * - ponctuation pleine largeur (， 。 ？ “ ”), y compris dans les gabarits ;
 * - pas de pluriel : `removeDetail` n'a qu'une forme, et le classificateur `个`
 *   est obligatoire devant le nom compte ;
 * - une espace fine separe les chiffres latins des caracteres chinois, sauf
 *   dans la graduation de la regle ou la place manque.
 */
const zh: typeof fr = {
  app: {
    name: 'Kumo 标志工作室',
    title: 'Kumo — 动画标志工作室',
    botAria: 'Kumo 动画标志预览'
  },

  gallery: {
    back: '返回播放器'
  },

  rail: {
    nav: '版块',
    customize: '创建标志',
    animations: '动画',
    settings: '设置'
  },

  panel: {
    animations: '动画',
    shape: '身体和腿',
    expression: '表情',
    color: '颜色'
  },

  kumo: {
    design: '四腿造型编辑器',
    designHelp: '自由摆放每条腿，让角色拥有独特姿态。',
    variation: '给我惊喜',
    bodyAspect: '身体比例',
    round: '圆形',
    tall: '更高',
    wide: '更宽',
    eyeColor: '眼睛颜色',
    eye_ink: '墨黑',
    eye_paper: '纸白',
    eye_cobalt: '钴蓝',
    eye_ember: '余烬红',
    eye_moss: '苔绿',
    eye_violet: '紫罗兰',
    eye_amber: '琥珀',
    legLanguage: '腿部造型',
    style_taper: '渐细',
    style_taperHelp: '从肩部到末端连续收窄的一体式腿。',
    style_paddle: '桨形',
    style_paddleHelp: '细窄的腿干连接宽而圆润的脚部。',
    style_knuckle: '关节',
    style_knuckleHelp: '单一连续轮廓，以平滑圆角连接两段直腿，没有球状鼓包。',
    stance: '姿态',
    stanceHelp: '从一种动作开始',
    stance_scout: '侦察',
    stance_pounce: '扑跃',
    stance_orbit: '环绕',
    stance_bloom: '绽放',
    composerAria: '四腿位置编辑器',
    dragHelp: '拖动身体周围的编号控制点来移动每条腿。',
    legHandle: '移动第 {number} 条腿',
    selectedLeg: '第 {number} 条腿',
    selectLeg: '选择要调整的腿',
    legPosition: '方向',
    legReach: '伸展',
    legBend: '弯曲',
    legLength: '腿部长度',
    legThickness: '腿部粗细',
    motion: '腿部运动',
    motionHelp: '自然的基础运动，并可加入 Kumo 独有的标志动作。',
    animationBreaks: '标志动作',
    animationBreaksHelp: '打断常规待机',
    rhythm_flow: '无',
    rhythm_breathe: '伸展',
    rhythm_skitter: '疾走',
    rhythm_doze: '蜷缩',
    break_flowHelp: '保持四条腿的常规待机运动，不插入标志动作。',
    break_breatheHelp: '四条腿一起舒展开来，短暂停留后回到待机。',
    break_skitterHelp: '三次快速的对角踏步依次掠过四条腿，然后恢复。',
    break_dozeHelp: '四条腿向内蜷缩，轻轻抽动一次，再缓慢展开。',
    motionAmount: '运动幅度',
    motionSpeed: '运动速度',
    reset: '重置 Kumo 设计'
  },

  export: {
    action: '导出 PNG',
    more: '其他格式',
    png: '下载 PNG',
    svg: '下载 SVG',
    anime: '下载 SVG 动图',
    gif: '下载 GIF 动图',
    cycleDetail: '视频更轻更流畅；GIF 到处都能播放。',
    cycleFormat: '格式',
    cycle_mp4: 'MP4 视频',
    cycle_mp4_aide: '轻巧流畅，必须有背景',
    cycle_gif: 'GIF 动图',
    cycle_gif_aide: '到处可播，体积更大',
    cycleProgress: '正在导出…',
    cycleReessayer: '重试',
    gifTitle: '下载 GIF 动图',
    gifDetail: 'GIF 的透明只有全有或全无：不加背景时，球体边缘会略显生硬。',
    gifBackground: '背景',
    fond_blanc: '白色背景',
    fond_blanc_aide: '边缘平滑，适合浅色底',
    fond_transparent: '透明背景',
    fond_transparent_aide: '适配任何背景，边缘略硬',
    gifConfirm: '下载',
    copie: '复制图片',
    copieSvg: '复制 SVG',
    done: '已导出',
    copied: '已复制',
    failed: '导出失败'
  },

  preview: {
    exit: '退出预览',
    key: 'Esc'
  },

  timeline: {
    play: '开始播放',
    pause: '停止播放',
    addAnimation: '添加动画',
    preview: '预览',
    export: '导出动画序列',
    zoom: '轨道缩放',
    blockAria: '{state}，{duration}',
    blockDurationAria: '{state} 的时长，{duration}',
    blockRemoveAria: '移除 {state}'
  },

  dialog: {
    cancel: '取消',
    nameCreateTitle: '新建序列',
    nameRenameTitle: '重命名序列',
    nameField: '序列名称',
    nameCreate: '创建',
    nameRename: '重命名',
    removeTitle: '删除“{name}”？',
    removeDetail: '该序列将被删除，其中包含的 {n} 个动画也将一并丢失。',
    removeConfirm: '删除'
  },

  cycles: {
    defaultName: '默认序列',
    newName: '我的序列',
    menuNew: '新建序列',
    menuRenameAria: '重命名 {name}',
    menuRemoveAria: '删除 {name}'
  },

  units: {
    seconds: '{n} 秒',
    secondsShort: '{n}秒'
  },

  settings: {
    title: '设置',
    language: '语言',
    about: '关于',
    credits: '由 {name} 用 ❤️ 打造',
    creditsAria: 'Jérémy 的 X 主页，在新标签页中打开',
    github: '在 GitHub 上查看项目',
    githubAria: '项目的 GitHub 仓库，在新标签页中打开'
  },

  states: {
    idle: '静止',
    thinking: '思考',
    wink: '眨眼',
    wide: '睁大眼睛',
    alert: '警示',
    notify: '通知',
    exclaim: '感叹号',
    sleep: '休眠',
    egg: '蛋形',
    hexagon: '六边形',
    play: '播放',
    orbit: '轨道',
    burst: '爆散',
    comet: '彗星',
    swirl: '漩涡'
  },

  shapes: {
    kumo: '自定义 Kumo',
    cercle: '圆形',
    galet: '卵石',
    squircle: '圆角方形',
    capsule: '胶囊',
    triangle: '三角形',
    hexagone: '六边形',
    nuage: '云朵',
    goutte: '水滴'
  },

  colors: {
    kumo: 'Kumo 灰',
    encre: '墨黑',
    creme: '奶油白',
    brun: '棕色',
    rouge: '红色',
    orange: '橙色',
    ambre: '琥珀色',
    vert: '绿色',
    turquoise: '青绿色',
    bleu: '蓝色',
    violet: '紫色',
    rose: '粉色',
    gris: '灰色'
  },

  expressions: {
    neutre: '平静',
    attentif: '专注',
    surpris: '惊讶',
    excite: '兴奋',
    heureux: '开心',
    hilare: '大笑',
    colere: '生气',
    triste: '难过',
    effraye: '害怕',
    mefiant: '怀疑',
    confus: '困惑',
    curieux: '好奇',
    fier: '得意',
    timide: '羞怯',
    blase: '无趣',
    somnolent: '困倦'
  }
}

export default zh
