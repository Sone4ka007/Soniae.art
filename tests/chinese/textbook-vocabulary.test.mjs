// Source: 新HSK教程4上 (New HSK Course 4A), lessons 1–10, 生词 tables,
// and 专有名词 index (printed p.127 / PDF page 137).
// Run: node tests/chinese/textbook-vocabulary.test.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../chinese/data');
const read = name => JSON.parse(readFileSync(resolve(dataRoot, name), 'utf8'));
const mainWords = [
  '签证 入学 通知 证件 材料 证 任何 食堂 座 申请 奖学金 表现 获得 要是 减轻 经济 压力 加油 随着 课程 专业 本科 硕士 研究生 博士 研究 活动 通过 交流 适应 将来 国际 当 教育 成为 教师 贸易 方面 知识 另',
  '房东 出租 房租 收拾 租 嗯 亮 就是 种 周围 不过 毕业 恐怕 热闹 入住 日记 顺利 并 客厅 台 厨房 平常 基本上 整个 毛巾 建议 查看 信息 查找 接着 同时 位置 价格 理想 由于 工资 感',
  '十字路口 直接 转 正好 熟悉 正 目的地 下载 进行 支付 软件 不仅 扫码 结账 购物 订 快递 现金 网购 寄 等 货 甚至 改变 手指 乱 管 提供 身份证 个人 能否 保护 于是 密码 随便 技术 法律 手段 保证 网络',
  '啊 停 交 费 信号 感谢 联系 方式 客气 剩 提 袋子 重 算 再说 之间 互相 辛苦 出行 距离 往往 既 电动车 速度 充电 流行 省 力气 乘客 购买 食物 免费 早餐 来得及 鲜花 顺便 心情 更加 愉快',
  '至少 中餐 专门 煮 油 道 熟 倒 辣椒 辣 敢 肚子 相同 顺序 够 不够 达到 聚 午餐 咸 凉 酸 汤 各 付 聚餐 随意 正式 普通 重视 座位 安排 按照 年龄 面对 主人 等 尊重',
  '咳嗽 咳 厉害 严重 赶快 陪 翻译 护士 表 性别 国籍 家庭 地址 挂号 排队 大厅 偶尔 身 结果 性 体温 降 光 打针 有效 按时 汗 醒 感觉 低 难受 通 过程 部 收费 情况 好 治疗 步',
  '打扰 市场 调查 计划 内容 改 细心 客户 真正 想法 任务 及时 出差 经验 采访 产品 看法 提前 便于 既然 谈 笔 生意 困难 优点 缺点 实际 效果 点 一下 份 积累 使 进入 社会 管理 基础 能力 今后',
  '紧张 放松 呀 不管 郊区 游玩 主意 外出 戴 帽子 项目 加班 熬夜 否则 失去 值得 暂停 之后 风景 效率 下降 相比 因此 提醒 与 大自然 美丽 景色 首都 市区 眼前 美景 参观 景点 交通 乘坐 十分 实际上',
  '祝 巧克力 感动 浪漫 幽默 耐心 吸引 当时 错过 幸运 幸福 尽管 性格 共同 责任 相互 理解 支持 印象 实在 阳光 负责 积极 此 从此 产生 爱情 间 友情 美好 人生 精彩 感情 深 经营 对方 感受 尤其 日子 从来',
  '小伙子 气温 零下 度 冻 后悔 就是 温度 差别 厚 寒假 暖和 低于 摄氏度 受不了 举办 各种 植物 公里 气候 而 此外 方言 普通话 较 使用 引起 误会 亲爱 再次 开展 绿色 环保 拒绝 浪费 节约 资源 光 垃圾 分类 日常',
].map(line => line.split(' '));
const properNouns = new Map([
  [3, '微信 支付宝'.split(' ')],
  [5, '水煮鱼 辣子鸡 松鼠鳜鱼 红烧羊肉 贵州 酸汤米线'.split(' ')],
  [8, '长城 故宫'.split(' ')],
  [10, '广州 哈尔滨'.split(' ')],
]);
const textbookPinyin = new Map([
  ['2:嗯', 'ng'], ['2:就是', 'jiùshi'],
  ['3:熟悉', 'shúxi'], ['3:十字路口', 'shízì lùkǒu'],
  ['4:啊', 'ā'],
  ['5:熟', 'shú / shóu'], ['5:不够', 'bùgòu'],
  ['9:实在', 'shízai'],
  ['10:就是', 'jiùshi'], ['10:零下', 'líng xià'],
]);
const norm = text => text.replace(/[\s。，？！、：；“”]/g, '');
const fail = (description, detail) => { throw new Error(description + ': ' + detail); };

const glossary = read('context-glossary.json');
const glossaryEntries = new Set(glossary.map(entry => entry.hanzi));
let totalMain = 0, totalProper = 0, totalTasks = 0;
for (let lessonNo = 1; lessonNo <= 10; lessonNo++) {
  const lesson = read('lesson' + lessonNo + '.json');
  const actualMain = lesson.words.filter(w => !w.properNoun).map(w => w.hanzi);
  const actualProper = lesson.words.filter(w => w.properNoun).map(w => w.hanzi);
  const expectedMain = mainWords[lessonNo - 1];
  const expectedProper = properNouns.get(lessonNo) ?? [];
  if (JSON.stringify(actualMain) !== JSON.stringify(expectedMain))
    fail('Core vocabulary differs from printed list, lesson ' + lessonNo, JSON.stringify({ actualMain, expectedMain }));
  if (JSON.stringify(actualProper) !== JSON.stringify(expectedProper))
    fail('Proper nouns differ from printed list, lesson ' + lessonNo, JSON.stringify({ actualProper, expectedProper }));
  const missions = lesson.quest.vocabMissions.flatMap(group => group.tasks);
  if (missions.length !== lesson.words.length)
    fail('Vocabulary mission count, lesson ' + lessonNo, missions.length);
  for (const word of lesson.words) {
    if (!word.hanzi || !word.pinyin || !word.ru) fail('Incomplete word, lesson ' + lessonNo, word.hanzi);
    const matches = missions.filter(task => task.word === word.hanzi);
    if (matches.length !== 1 || !matches[0].sentence.includes(word.hanzi))
      fail('Vocabulary mission missing or duplicated, lesson ' + lessonNo, word.hanzi);
    const expectedPinyin = textbookPinyin.get(lessonNo + ':' + word.hanzi);
    if (expectedPinyin && word.pinyin !== expectedPinyin)
      fail('Textbook pinyin mismatch, lesson ' + lessonNo, word.hanzi + ' ' + word.pinyin);
    if (word.properNoun && !glossaryEntries.has(word.hanzi))
      fail('Proper noun missing in glossary, lesson ' + lessonNo, word.hanzi);
  }
  for (const sentence of lesson.sentences) {
    if (norm(sentence.zh) !== norm(sentence.parts.join('')))
      fail('Sentence parts mismatch, lesson ' + lessonNo, sentence.zh);
    if (!sentence.variants.some(parts => norm(sentence.zh) === norm(parts.join(''))))
      fail('Sentence variant mismatch, lesson ' + lessonNo, sentence.zh);
    if (sentence.targets.some(target => !sentence.zh.includes(target)))
      fail('Sentence target missing, lesson ' + lessonNo, sentence.zh);
  }
  totalMain += actualMain.length;
  totalProper += actualProper.length;
  totalTasks += missions.length;
}
if (totalMain !== 391 || totalProper !== 12 || totalTasks !== 403)
  fail('Unexpected totals', JSON.stringify({ totalMain, totalProper, totalTasks }));
console.log('PASS: 10 lessons; 391 main words; 12 proper nouns; 403 vocabulary missions; all sentence assemblies valid.');
