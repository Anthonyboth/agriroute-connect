

## Diagnose: Scroll cortado no iPhone (Capacitor)

**Problema identificado**: No iPhone com Capacitor, a parte inferior da tela fica coberta pelo "home indicator" do iOS (a barra branca na parte de baixo). O container principal do `DriverDashboard` usa `min-h-screen` mas nao tem padding-bottom para compensar a safe area do iOS. Resultado: o botao "Contraproposta" fica inacessivel.

**Causa raiz (2 pontos)**:

1. `index.html` - viewport meta NAO tem `viewport-fit=cover`, entao `env(safe-area-inset-bottom)` nao funciona
2. `DriverDashboard.tsx` - container principal nao tem padding-bottom para safe area

---

## Plano de correcao

### 1. Adicionar `viewport-fit=cover` no viewport meta (index.html)

Alterar a tag meta viewport para:
```
width=device-width, initial-scale=1.0, minimum-scale=0.5, maximum-scale=3.0, user-scalable=yes, viewport-fit=cover
```

### 2. Adicionar padding-bottom seguro no DriverDashboard

No container principal (`div.min-h-screen.bg-background`), adicionar padding-bottom para a safe area do iOS:

```
className="min-h-screen bg-background pb-[env(safe-area-inset-bottom,0px)]"
```

### 3. Garantir padding-bottom global para iOS Capacitor (index.css)

Adicionar regra CSS global para que o body/root tenha padding-bottom respeitando a safe area em contexto Capacitor:

```css
/* iOS Capacitor safe area bottom padding */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .safe-bottom-padding {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
}
```

### 4. Aplicar padding-bottom nas paginas de dashboard

Aplicar a mesma classe de safe-area nas outras paginas de dashboard (`CompanyDashboard`, `ProducerDashboard`) para consistencia.

---

**Apos implementacao**: O usuario deve fazer `git pull && npm run build && npx cap sync ios` e rodar no Xcode novamente para testar.

