

## Plano: Substituir splash screen do iOS pelo logo correto

O usuário enviou a imagem correta do logo AgriRoute (pin verde com folha branca) que deve ser usada como splash screen no iOS.

### Ações

1. **Copiar a imagem enviada** (`user-uploads://download-6.png`) para os 3 assets de splash do iOS:
   - `ios/App/App/Assets.xcassets/Splash.imageset/splash-1x.png`
   - `ios/App/App/Assets.xcassets/Splash.imageset/splash-2x.png`
   - `ios/App/App/Assets.xcassets/Splash.imageset/splash-3x.png`

2. **Atualizar o `Contents.json`** com as dimensoes corretas da imagem enviada.

3. **Atualizar o `LaunchScreen.storyboard`** para refletir as dimensoes corretas do novo asset e manter o logo centralizado com fundo branco.

4. **Instruir o usuario** a rodar `npx cap sync ios` apos o git pull para sincronizar os assets.

