

## Problema

O `LaunchScreen.storyboard` e o `capacitor.config.ts` já estão com `backgroundColor: white`, mas a **imagem** referenciada pelo storyboard (`Splash` no asset catalog) ainda tem fundo verde com o logo num quadrado branco. O iOS renderiza essa imagem sobre o fundo branco, resultando no visual verde que você vê.

## Solução

Gerar novas imagens de splash com:
- **Fundo 100% transparente ou branco** (sem verde)
- **Logo AgriRoute (folha verde)** centralizado
- Três tamanhos: 200x200 (1x), 400x400 (2x), 600x600 (3x)

Substituir os arquivos:
- `ios/App/App/Assets.xcassets/Splash.imageset/splash-1x.png`
- `ios/App/App/Assets.xcassets/Splash.imageset/splash-2x.png`
- `ios/App/App/Assets.xcassets/Splash.imageset/splash-3x.png`

## Após implementação

Rodar:
```bash
git pull
npm run build
npx cap sync ios
```

No Xcode: **Cmd + Shift + K** (limpar) → **Cmd + R** (rodar). Se o cache persistir, deletar o app do simulador/dispositivo antes de rodar.

