import { telegramApiUpload } from './telegram-api.js';

/** https://core.telegram.org/bots/api#inputprofilephotostatic requires a new JPEG upload. */
export function profilePhotoForm(jpeg: Uint8Array): FormData {
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8 || jpeg[2] !== 0xff) {
    throw new Error('The bot profile photo must be a JPEG file');
  }
  if (jpeg.length > 10 * 1024 * 1024) throw new Error('The bot profile photo must be smaller than 10 MB');
  const form = new FormData();
  form.set('photo', JSON.stringify({ type: 'static', photo: 'attach://profile_photo' }));
  form.set('profile_photo', new Blob([Uint8Array.from(jpeg)], { type: 'image/jpeg' }), 'uzdonate-profile.jpg');
  return form;
}

export async function setStoreBotProfilePhoto(jpeg: Uint8Array): Promise<void> {
  await telegramApiUpload('setMyProfilePhoto', profilePhotoForm(jpeg));
}
