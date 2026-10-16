export function topUpReviewKeyboard(requestId: string) {
  return { inline_keyboard: [
    [
      { text: '✅ Tasdiqlash', callback_data: `topup:approve:${requestId}` },
      { text: '❌ Rad etish', callback_data: `topup:reject:${requestId}` },
    ],
    [{ text: '✏️ Boshqa summa', callback_data: `topup:amount:${requestId}` }],
  ] };
}
