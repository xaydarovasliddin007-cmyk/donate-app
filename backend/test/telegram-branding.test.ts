import { beforeEach, describe, expect, it, vi } from 'vitest';

const { uploadMock } = vi.hoisted(() => ({ uploadMock: vi.fn() }));
vi.mock('../src/modules/telegram/telegram-api.js', () => ({ telegramApiUpload: uploadMock }));

import { profilePhotoForm, setStoreBotProfilePhoto } from '../src/modules/telegram/telegram-branding.js';

describe('Telegram bot profile upload', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]);
  beforeEach(() => uploadMock.mockReset().mockResolvedValue(true));

  it('uploads a new JPEG with the documented InputProfilePhotoStatic attachment', async () => {
    const form = profilePhotoForm(jpeg);
    expect(JSON.parse(String(form.get('photo')))).toEqual({ type: 'static', photo: 'attach://profile_photo' });
    const file = form.get('profile_photo') as File;
    expect(file.name).toBe('uzdonate-profile.jpg');
    expect(file.type).toBe('image/jpeg');
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(jpeg);
  });

  it('uses setMyProfilePhoto with multipart data rather than a remote image URL', async () => {
    await setStoreBotProfilePhoto(jpeg);
    expect(uploadMock).toHaveBeenCalledWith('setMyProfilePhoto', expect.any(FormData));
    expect(uploadMock).toHaveBeenCalledTimes(1);
  });

  it('rejects PNG or oversized input before calling Telegram', async () => {
    await expect(setStoreBotProfilePhoto(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).rejects.toThrow('JPEG');
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
    oversized.set(jpeg);
    await expect(setStoreBotProfilePhoto(oversized)).rejects.toThrow('10 MB');
    expect(uploadMock).not.toHaveBeenCalled();
  });
});
