#!/bin/bash

echo "🔄 Configurando assinatura automática para iOS..."

cd ios/App

# Verificar se o arquivo existe
if [ ! -f "App.xcodeproj/project.pbxproj" ]; then
    echo "❌ Arquivo do projeto não encontrado"
    exit 1
fi

# Backup
cp App.xcodeproj/project.pbxproj App.xcodeproj/project.pbxproj.backup

# Usar sed para garantir as configurações corretas
DEVELOPMENT_TEAM="4YULT95XAK"

# Garantir CODE_SIGN_STYLE = Automatic em todas as configurações
sed -i.bak 's/CODE_SIGN_STYLE = Manual;/CODE_SIGN_STYLE = Automatic;/g' App.xcodeproj/project.pbxproj

# Garantir DEVELOPMENT_TEAM está presente
if ! grep -q "DEVELOPMENT_TEAM = \;" App.xcodeproj/project.pbxproj; then
    # Adicionar DEVELOPMENT_TEAM após buildSettings = {
    sed -i.bak '/buildSettings = {/a\
                DEVELOPMENT_TEAM = 4YULT95XAK;' App.xcodeproj/project.pbxproj
fi

# Remover arquivos de backup do sed
rm -f App.xcodeproj/project.pbxproj.bak

echo "✅ Configuração de assinatura automática concluída!"
echo "=== Configurações verificadas ==="
grep -n "DEVELOPMENT_TEAM\|CODE_SIGN_STYLE" App.xcodeproj/project.pbxproj
