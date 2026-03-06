

## Plano: Padronizar círculos do Progresso da Viagem em zigzag

### O que será feito

Modificar o componente `FreightStatusTracker.tsx` (linhas ~470-530) para que os círculos de progresso alternem posição:
- **Círculos ímpares (1º, 3º, 5º)**: acima da linha central
- **Círculos pares (2º, 4º)**: abaixo da linha central
- **Último círculo (Entrega Reportada)**: centralizado na linha

### Layout visual

```text
   ●           ●           
   |           |           
───┼─────┼─────┼─────┼─────●───
         |           |      
         ●           ●     
 Aceito  Coleta  Carreg. Trâns. Entrega
```

### Alterações técnicas

**Arquivo: `src/components/FreightStatusTracker.tsx`** (linhas ~470-530)

1. Aumentar a altura do container para acomodar o zigzag
2. Posicionar a linha de progresso no centro vertical do container
3. Para cada círculo, aplicar `translateY` negativo (acima) ou positivo (abaixo) conforme índice, exceto o último que fica centralizado na linha
4. Labels acompanham o deslocamento do respectivo círculo
5. Aplicar mesma lógica para ambos os fluxos (`DEFAULT_FLOW` e `MOTO_FLOW`)

