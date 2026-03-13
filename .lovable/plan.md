

## Diagnóstico: ClassNotFoundException no Google Play

O erro reportado pelo Google Play é:

```
java.lang.ClassNotFoundException: Não foi encontrada a classe "com.agriroute.connect.MainActivity"
```

### Causa raiz

O repositório define a MainActivity no pacote Java `app.lovable.f2dbc20153194f90a3cc8dd215bbebba`:

```
android/app/src/main/java/app/lovable/f2dbc20153194f90a3cc8dd215bbebba/MainActivity.java
```

Porém, no seu build local, você altera o `applicationId` e `namespace` para `com.agriroute.connect`. O Android resolve `android:name=".MainActivity"` no AndroidManifest como `{namespace}.MainActivity`, ou seja, `com.agriroute.connect.MainActivity`.

**Mas a classe Java compilada continua no pacote `app.lovable.f2dbc20153194f90a3cc8dd215bbebba`**. O Android não encontra a classe no pacote esperado → crash imediato.

Isso é um **desalinhamento entre namespace/applicationId de produção e o pacote Java real da MainActivity**.

### Como resolver (mudança no repositório)

Precisamos que o AndroidManifest use o nome **completo (fully-qualified)** da Activity em vez do relativo (`.MainActivity`), para que funcione independentemente do namespace configurado localmente.

**Arquivo:** `android/app/src/main/AndroidManifest.xml`

**Mudança:** Linha 15 — trocar `android:name=".MainActivity"` por `android:name="app.lovable.f2dbc20153194f90a3cc8dd215bbebba.MainActivity"`

Isso garante que o Android sempre encontre a classe no pacote correto, mesmo quando o `namespace` e `applicationId` são alterados localmente para `com.agriroute.connect`.

### Registro de regressão

Registrar como **FRT-065** no `useRegressionShield.ts`:
- Bug: `ClassNotFoundException` ao usar applicationId diferente do pacote Java
- Causa: `android:name=".MainActivity"` resolve relativo ao namespace
- Regra: sempre usar nome fully-qualified no AndroidManifest

### Resumo das mudanças

| Arquivo | Mudança |
|---|---|
| `android/app/src/main/AndroidManifest.xml` | `.MainActivity` → nome completo |
| `src/hooks/useRegressionShield.ts` | Registrar FRT-065 |

