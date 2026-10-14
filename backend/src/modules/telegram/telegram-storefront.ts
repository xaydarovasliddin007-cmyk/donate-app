import { telegramApi, TelegramApiError } from './telegram-api.js';

const COMMANDS = ['start', 'shop', 'prices', 'help', 'paysupport', 'terms'] as const;
export type StorefrontCommand = `/${typeof COMMANDS[number]}`;
type StoreLocale = 'uz' | 'ru';
type MenuLocale = StoreLocale | 'en';

interface StorefrontConfig {
  publicAppUrl?: string;
  supportUrl: string;
  release?: string;
}

const menuDescriptions: Record<MenuLocale, readonly string[]> = {
  uz: ["UZDONATE bilan tanishish", "O'yinlar va paketlar", 'Amaldagi narxlar', 'Qanday buyurtma berish', "To'lov va buyurtma yordami", 'Shartlar va maxfiylik'],
  ru: ['Знакомство с UZDONATE', 'Игры и пакеты', 'Актуальные цены', 'Как оформить заказ', 'Помощь с оплатой и заказом', 'Условия и конфиденциальность'],
  en: ['Welcome to UZDONATE', 'Games and packages', 'Current prices', 'How to place an order', 'Payment and order support', 'Terms and privacy'],
};

export const STORE_BOT_DESCRIPTIONS: Record<MenuLocale, { description: string; shortDescription: string; menuButton: string }> = {
  uz: {
    description: "UZDONATE — o'yin valyutalari va passlari. O'yin va paketni tanlang, o'yin ID'ingizni kiriting va buyurtma holatini do'konda kuzating. Savollar uchun /help.",
    shortDescription: "O'yiningiz uchun almazlar, UC va passlar. Paketlar, narxlar va buyurtmalar — UZDONATE'da.",
    menuButton: "Do'kon",
  },
  ru: {
    description: 'UZDONATE — игровая валюта и пропуски. Выберите игру и пакет, укажите игровой ID и следите за статусом заказа в магазине. Помощь: /help.',
    shortDescription: 'Алмазы, UC и игровые пропуски. Пакеты, цены и ваши заказы — в UZDONATE.',
    menuButton: 'Магазин',
  },
  en: {
    description: 'UZDONATE — game currency and passes. Choose a game and package, enter your player ID, and track your order in the store. For help, use /help.',
    shortDescription: 'Diamonds, UC and game passes. Packages, prices and your orders in UZDONATE.',
    menuButton: 'Store',
  },
};

export function storeBotCommands(locale: MenuLocale = 'uz') {
  return COMMANDS.map((command, index) => ({ command, description: menuDescriptions[locale][index]! }));
}

export function isStorefrontCommand(value: string): value is StorefrontCommand {
  return COMMANDS.some((command) => value === `/${command}`);
}

function escapeHtml(value: string) {
  return value.slice(0, 64).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function storefrontReply(command: StorefrontCommand, languageCode: string | undefined, firstName: string | undefined, config: StorefrontConfig) {
  const ru = languageCode?.toLowerCase().startsWith('ru') ?? false;
  const en = languageCode?.toLowerCase().startsWith('en') ?? false;
  const name = escapeHtml(firstName ?? '');
  const greeting = ru ? (name ? `Привет, ${name}!` : 'Привет!')
    : en ? (name ? `Hi, ${name}!` : 'Hi!') : (name ? `Salom, ${name}!` : 'Salom!');
  const messages: Record<StorefrontCommand, string> = ru ? {
    '/start': `<b>UZDONATE</b>\n${greeting}\n\nАлмазы, UC и игровые пропуски.\nВыберите игру и пакет, проверьте игровой ID и оформите заказ.\n\nЦены и статус ваших заказов — в магазине.`,
    '/shop': '<b>Ваш следующий игровой пакет</b>\n\nОткройте магазин, выберите игру и нужный пакет. Перед оплатой проверьте игровой ID, сервер и итоговую стоимость.',
    '/prices': '<b>Актуальные цены</b>\n\nСтоимость зависит от игры, пакета и региона. Все доступные пакеты и текущие цены показаны в магазине. Итоговая сумма отображается перед оплатой.',
    '/help': '<b>Как оформить заказ</b>\n\n1. Выберите игру и пакет.\n2. Введите игровой ID и сервер, если он нужен.\n3. Проверьте данные и оплатите заказ.\n4. Следите за статусом в разделе заказов магазина.\n\nЕсли нужна помощь, отправьте оператору номер заказа. Не передавайте пароль или коды входа.',
    '/paysupport': '<b>Помощь с оплатой и заказом</b>\n\nОтправьте оператору номер заказа и кратко опишите вопрос. Для пополнения баланса приложите чек, если он есть.\n\nЕсли оплата уже прошла, сначала проверьте статус заказа. Не отправляйте пароль, коды входа или CVV карты.',
    '/terms': '<b>Условия и конфиденциальность</b>\n\nПеред оплатой ознакомьтесь с условиями сервиса и политикой конфиденциальности. Проверьте игру, пакет, игровой ID и сервер. По вопросам оплаты и возврата обратитесь в поддержку с номером заказа.',
  } : en ? {
    '/start': `<b>UZDONATE</b>\n${greeting}\n\nDiamonds, UC and game passes.\nChoose a game and package, check your player ID and place your order.\n\nCurrent prices and your order status are in the store.`,
    '/shop': '<b>Your next game package</b>\n\nOpen the store and choose a game and package. Check your player ID, server and final price before paying.',
    '/prices': '<b>Current prices</b>\n\nPrices depend on the game, package and region. Available packages and current prices are shown in the store. You will see the final total before paying.',
    '/help': '<b>How to place an order</b>\n\n1. Choose a game and package.\n2. Enter your player ID and server, if required.\n3. Check the details and pay.\n4. Track the status in the store’s orders section.\n\nFor help, send your order number to support. Never share your password or sign-in codes.',
    '/paysupport': '<b>Payment and order support</b>\n\nSend support your order number and a brief description of the issue. For a wallet top-up, attach your receipt if available.\n\nIf you have already paid, check the order status first. Never send your password, sign-in codes or card CVV.',
    '/terms': '<b>Terms and privacy</b>\n\nRead the service terms and privacy policy before paying. Check the game, package, player ID and server. Contact support with your order number for payment or refund questions.',
  } : {
    '/start': `<b>UZDONATE</b>\n${greeting}\n\nAlmazlar, UC va o'yin passlari.\nO'yin va paketni tanlang, o'yin ID'ingizni tekshiring va buyurtma bering.\n\nNarxlar va buyurtmalaringiz holati — do'konda.`,
    '/shop': "<b>O'yiningiz uchun navbatdagi paket</b>\n\nDo'konni oching, o'yin va kerakli paketni tanlang. To'lovdan oldin o'yin ID'ingiz, server va yakuniy narxni tekshiring.",
    '/prices': "<b>Amaldagi narxlar</b>\n\nNarx o'yin, paket va hududga bog'liq. Mavjud paketlar va joriy narxlar do'konda ko'rsatiladi. Yakuniy summa to'lovdan oldin chiqadi.",
    '/help': "<b>Qanday buyurtma beriladi?</b>\n\n1. O'yin va paketni tanlang.\n2. O'yin ID'ingizni va kerak bo'lsa serverni kiriting.\n3. Ma'lumotlarni tekshirib, to'lov qiling.\n4. Holatni do'kondagi buyurtmalar bo'limida kuzating.\n\nYordam kerak bo'lsa, operatorga buyurtma raqamini yuboring. Parol yoki kirish kodlarini bermang.",
    '/paysupport': "<b>To'lov va buyurtma bo'yicha yordam</b>\n\nOperatorga buyurtma raqamini yuboring va savolingizni qisqacha yozing. Balans to'ldirish bo'yicha chek bo'lsa, uni ham ilova qiling.\n\nTo'lov o'tgan bo'lsa, avval buyurtma holatini tekshiring. Parol, kirish kodi yoki kartaning CVV kodini yubormang.",
    '/terms': "<b>Shartlar va maxfiylik</b>\n\nTo'lovdan oldin xizmat shartlari va maxfiylik siyosati bilan tanishing. O'yin, paket, o'yin ID va serverni tekshiring. To'lov yoki qaytarish bo'yicha buyurtma raqami bilan yordam xizmatiga murojaat qiling.",
  };
  const rows: Record<string, unknown>[][] = [];
  if (config.publicAppUrl) {
    const store = new URL('/webapp/', config.publicAppUrl);
    store.searchParams.set('v', config.release ?? 'current');
    rows.push([{
      text: command === '/prices' ? (ru ? 'Смотреть цены' : en ? 'View prices' : "Narxlarni ko'rish")
        : (ru ? 'Открыть магазин' : en ? 'Open store' : "Do'konni ochish"),
      web_app: { url: store.href },
    }]);
    if (command === '/terms') rows.push([
      { text: ru ? 'Условия' : en ? 'Service terms' : 'Xizmat shartlari', url: new URL('/webapp/terms.html', config.publicAppUrl).href },
      { text: ru ? 'Конфиденциальность' : en ? 'Privacy' : 'Maxfiylik', url: new URL('/webapp/privacy.html', config.publicAppUrl).href },
    ]);
  }
  rows.push([{ text: ru ? 'Написать в поддержку' : en ? 'Contact support' : 'Yordam xizmatiga yozish', url: config.supportUrl }]);
  return {
    text: messages[command],
    reply_markup: { inline_keyboard: rows },
    photo: command === '/start' && config.publicAppUrl
      ? new URL('/webapp/assets-store/brand-bot-card.png', config.publicAppUrl).href
      : undefined,
  };
}

export async function sendStorefrontCommand(chatId: number, command: StorefrontCommand, languageCode: string | undefined, firstName: string | undefined, config: StorefrontConfig) {
  const message = storefrontReply(command, languageCode, firstName, config);
  const reply = { chat_id: chatId, parse_mode: 'HTML', reply_markup: message.reply_markup };
  if (message.photo) {
    try {
      await telegramApi('sendPhoto', { ...reply, photo: message.photo, caption: message.text });
      return;
    } catch (error) {
      // Keep the welcome usable when Telegram cannot retrieve the brand card.
      if (!(error instanceof TelegramApiError) || !/photo|image|file|HTTP URL|WEBPAGE/i.test(error.description)) throw error;
    }
  }
  await telegramApi('sendMessage', { ...reply, text: message.text });
}
