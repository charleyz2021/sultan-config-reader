/*
 * 阅读器翻译字典
 *
 * app.js 里的解析逻辑只负责识别配置语法；这里集中维护中文文案、别名、类型名和特殊标签。
 * 这样新增翻译时通常只需要改这份表，不必进入复杂的解析/渲染函数。
 *
 * 字段说明：
 * - counterNameMap：固定计数器 ID 的显示名。
 * - entityAliasMap：把“妻子”等标签映射到代表性卡牌，用于需要预览卡牌的场景。
 * - namePlaceholderMap：把配置文本里的 xxx.name 占位符替换成人类可读文本。
 * - typeLabelMap：把 char/item/sudan 等内部类型翻译成界面标签。
 * - tableHaveSpecialCardCountLabels：处理 table_have.xxx= 里苏丹卡类型的特殊计数文案。
 * - actionTextMap：action 键名的基础中文翻译，复杂动作仍由 app.js 组合说明。
 */
window.SULTAN_TRANSLATIONS = {
  counterNameMap: {
    7100001: "善名",
    7100002: "恶名",
    7100003: "权势",
    7100004: "侠名",
    7100005: "灵视"
  },
  counterSpecialNameMap: {},
  entityDisplayNameMap: {},
  entityAliasMap: {
    妻子: 2000006
  },
  namePlaceholderMap: {
    "xiaochou.name": "小筹的名字",
    "player.name": "玩家的名字",
    "table.宰相.name": "场上宰相的名字",
    "table.被献祭.name": "场上被献祭者的名字",
    "table.被牺牲.name": "场上被牺牲者的名字",
    "table.被驱逐.name": "场上被驱逐者的名字"
  },
  typeLabelMap: {
    char: "角色",
    item: "物品",
    sudan: "苏丹卡",
    monster: "怪物",
    army: "军队",
    TREASURE: "奇珍"
  },
  tableHaveSpecialCardCountLabels: {
    sudan: "苏丹卡",
    纵欲: "纵欲卡",
    奢靡: "奢靡卡",
    杀戮: "杀戮卡",
    征服: "征服卡"
  },
  actionTextMap: {
    prompt: "显示提示文本",
    delay: "延迟执行后续动作",
    no_show: "隐藏展示或提示",
    no_prompt: "不显示提示文本",
    begin_guide: "开始教程",
    choose: "出现选择",
    confirm: "等待确认",
    option: "显示选项",
    close_box: "关闭弹窗",
    change_desk_bg: "更换桌面背景",
    change_name: "修改名称",
    success: "标记成功",
    failed: "标记失败",
    sleep: "进入休整或睡眠",
    slide: "播放过场或演出效果",
    debug: "调试用标记",
    difficulty: "按当前难度处理",
    enable_auto_gen_sudan_card: "开启自动生成苏丹卡",
    magic_sudan: "处理特殊苏丹卡逻辑",
    steam_achievement: "解锁成就"
  }
};
