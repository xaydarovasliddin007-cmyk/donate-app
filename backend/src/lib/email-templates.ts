/** Shared HTML shell for transactional emails — inline styles only, since email clients strip <style> blocks and JS. */
function emailShell(bodyHtml: string): string {
  return `<!doctype html>
<html lang="uz">
  <body style="margin:0;padding:0;background-color:#0B0F1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B0F1A;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background-color:#141A2B;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#3B6FF6,#7C5CFC);padding:28px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:0.5px;">UZDONATE</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">${bodyHtml}</td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <p style="margin:0;color:#5B6478;font-size:12px;line-height:18px;">
                  Bu xabarni siz so'ramagan bo'lsangiz, shunchaki e'tiborsiz qoldiring.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function verificationCodeEmail(code: string): { subject: string; text: string; html: string } {
  const subject = 'UZDONATE — email tasdiqlash kodi';
  const text = `Sizning UZDONATE tasdiqlash kodingiz: ${code}\n\nBu kod 15 daqiqa amal qiladi. Agar bu so'rovni siz yubormagan bo'lsangiz, shunchaki e'tiborsiz qoldiring.`;
  const html = emailShell(`
    <p style="margin:0 0 8px;color:#ffffff;font-size:18px;font-weight:700;">Email manzilingizni tasdiqlang</p>
    <p style="margin:0 0 24px;color:#9BA3B7;font-size:14px;line-height:20px;">
      UZDONATE ilovasidan ro'yxatdan o'tishni yakunlash uchun quyidagi kodni kiriting:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
      <tr>
        ${code
          .split('')
          .map(
            (digit) =>
              `<td style="width:40px;height:52px;background-color:#1F2740;border-radius:10px;text-align:center;vertical-align:middle;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:0;">${digit}</td><td style="width:8px;"></td>`,
          )
          .join('')}
      </tr>
    </table>
    <p style="margin:0;color:#5B6478;font-size:13px;line-height:18px;text-align:center;">
      Kod 15 daqiqa amal qiladi.
    </p>
  `);
  return { subject, text, html };
}
