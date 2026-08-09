import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/preferences_provider.dart';

/// The set of locales the app ships translations for today. Adding English
/// or another language later is just: add the ARB file + append here.
const supportedLocales = [Locale('uz'), Locale('ru')];
const defaultLocale = Locale('uz');

class LocaleController extends Notifier<Locale> {
  @override
  Locale build() {
    final saved = ref.read(preferencesServiceProvider).locale;
    return _decode(saved);
  }

  Future<void> setLocale(Locale locale) async {
    state = locale;
    await ref.read(preferencesServiceProvider).setLocale(locale.languageCode);
  }

  static Locale _decode(String? value) {
    final match = supportedLocales.where((l) => l.languageCode == value);
    return match.isNotEmpty ? match.first : defaultLocale;
  }
}

final localeControllerProvider = NotifierProvider<LocaleController, Locale>(LocaleController.new);
