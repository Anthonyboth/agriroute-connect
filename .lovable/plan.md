
# Correção DEFINITIVA do Crash Android - Causa Raiz Encontrada

## Problema Real Identificado

O crash acontece ANTES de qualquer código JavaScript executar. O erro está no arquivo **`android/app/src/main/res/values/styles.xml`** -- a configuração do tema de Splash Screen está incorreta.

### O que está errado

O tema `AppTheme.NoActionBarLaunch` usa `parent="Theme.SplashScreen"` (API do Android 12 SplashScreen) mas:

1. Usa `android:background` em vez de `windowSplashScreenBackground` -- atributo incorreto para esse tema
2. **Falta o atributo obrigatório `postSplashScreenTheme`** -- sem isso, o Android não sabe para qual tema transicionar após o splash, causando crash da Activity

Isso explica por que NENHUMA das correções anteriores (cleanup de manifest, try/catch no JS, preservar console.error) resolveu: o crash acontece na camada nativa do Android, antes do WebView sequer carregar o HTML.

### Evidencia

A documentacao oficial do Android diz:
> "Create a theme with a parent of Theme.SplashScreen, and set the values of postSplashScreenTheme to the theme that the Activity should use. **Required.**"

O styles.xml atual:
```text
<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="android:background">@drawable/splash</item>   <-- ERRADO
    <!-- postSplashScreenTheme AUSENTE -->                      <-- FALTA
</style>
```

## Plano de Correção

### Etapa 1: Corrigir styles.xml (CAUSA RAIZ)

Corrigir o tema para usar os atributos corretos da API Theme.SplashScreen:

```text
<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">#16a34a</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/splash</item>
    <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
</style>
```

Mudancas:
- `android:background` substituido por `windowSplashScreenBackground` (cor verde AgriRoute)
- Adicionado `windowSplashScreenAnimatedIcon` para exibir o splash.png como icone
- Adicionado `postSplashScreenTheme` apontando para `AppTheme.NoActionBar` (OBRIGATORIO)

### Etapa 2: Adicionar usesCleartextTraffic ao AndroidManifest (Seguranca)

Adicionar `android:usesCleartextTraffic="true"` na tag `<application>` do AndroidManifest.xml para garantir que o Capacitor local server funcione em todos os dispositivos Android.

### Etapa 3: Definir build target ES2017 no Vite (Compatibilidade)

Adicionar `target: 'es2017'` ao `build` do `vite.config.ts` para garantir compatibilidade com WebViews mais antigos (Android 7+).

## Detalhes Tecnicos

### styles.xml (CORREÇÃO PRINCIPAL)
```text
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">#16a34a</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>
```

### AndroidManifest.xml
Adicionar na tag `<application>`:
```text
android:usesCleartextTraffic="true"
```

### vite.config.ts
Adicionar no bloco `build`:
```text
target: 'es2017',
```

## Por que as correções anteriores não funcionaram

As correções anteriores (cleanup de manifest, try/catch, console.error) foram todas no **nivel web/JavaScript**. Mas o crash acontece no **nivel nativo Android** -- a Activity crasha ao tentar carregar o tema incorreto, ANTES do WebView carregar qualquer HTML ou JS.

## Passos apos aplicar

1. `git pull`
2. `npm run build`
3. `npx cap sync`
4. `npx cap run android`
