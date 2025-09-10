import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tag, Percent, Clock, Gift, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Promotion {
  id: string;
  code: string;
  title: string;
  description: string;
  discount_type: 'PERCENTAGE' | 'FIXED';
  discount_value: number;
  min_amount: number;
  max_uses: number;
  current_uses: number;
  valid_from: string;
  valid_until: string;
  active: boolean;
}

export const PromotionsCenter = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPromotions = async () => {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter valid promotions
      const now = new Date();
      const validPromotions = data?.filter(promo => 
        isBefore(new Date(promo.valid_from), now) &&
        isAfter(new Date(promo.valid_until), now) &&
        promo.current_uses < (promo.max_uses || Infinity)
      ) || [];

      setPromotions(validPromotions as Promotion[]);
    } catch (error) {
      console.error('Error fetching promotions:', error);
    }
  };

  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      toast({
        title: "Erro",
        description: "Digite um código promocional",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('code', promoCode.toUpperCase())
        .eq('active', true)
        .single();

      if (error || !data) {
        toast({
          title: "Código Inválido",
          description: "Código promocional não encontrado ou expirado",
          variant: "destructive",
        });
        return;
      }

      const now = new Date();
      const isValidPeriod = isBefore(new Date(data.valid_from), now) && 
                           isAfter(new Date(data.valid_until), now);
      const hasUsesLeft = data.current_uses < (data.max_uses || Infinity);

      if (!isValidPeriod) {
        toast({
          title: "Código Expirado",
          description: "Este código promocional não está mais válido",
          variant: "destructive",
        });
        return;
      }

      if (!hasUsesLeft) {
        toast({
          title: "Código Esgotado",
          description: "Este código promocional já foi usado o máximo de vezes",
          variant: "destructive",
        });
        return;
      }

      setAppliedPromo(data as Promotion);
      toast({
        title: "Código Aplicado!",
        description: `Desconto de ${data.discount_type === 'PERCENTAGE' ? data.discount_value + '%' : 'R$ ' + data.discount_value} aplicado`,
      });
    } catch (error) {
      console.error('Error validating promo code:', error);
      toast({
        title: "Erro",
        description: "Erro ao validar código promocional",
        variant: "destructive",
      });
    }
  };

  const copyPromoCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({
      title: "Copiado!",
      description: "Código copiado para a área de transferência",
    });
  };

  const removeAppliedPromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    toast({
      title: "Código Removido",
      description: "Código promocional removido",
    });
  };

  const getDiscountText = (promo: Promotion) => {
    if (promo.discount_type === 'PERCENTAGE') {
      return `${promo.discount_value}% OFF`;
    } else {
      return `R$ ${promo.discount_value} OFF`;
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Tag className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Promoções e Códigos</h1>
      </div>

      {/* Aplicar Código Promocional */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Aplicar Código Promocional
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appliedPromo ? (
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">
                    {appliedPromo.title}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-300">
                    Código: {appliedPromo.code} - {getDiscountText(appliedPromo)}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={removeAppliedPromo}
              >
                Remover
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Digite o código promocional"
                onKeyPress={(e) => e.key === 'Enter' && validatePromoCode()}
              />
              <Button onClick={validatePromoCode}>
                Aplicar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Promoções Ativas */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Promoções Ativas
        </h2>
        
        {promotions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhuma promoção ativa no momento
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promotions.map((promo) => (
              <Card key={promo.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{promo.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {promo.description}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-primary text-primary-foreground">
                      {getDiscountText(promo)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="font-mono font-bold text-lg">{promo.code}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyPromoCode(promo.code)}
                        className="h-8 w-8 p-0"
                      >
                        {copiedCode === promo.code ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      {promo.min_amount && (
                        <p className="flex items-center gap-2">
                          <span className="font-medium">Valor mínimo:</span>
                          <span>R$ {promo.min_amount}</span>
                        </p>
                      )}
                      
                      {promo.max_uses && (
                        <p className="flex items-center gap-2">
                          <span className="font-medium">Usos restantes:</span>
                          <span>{promo.max_uses - promo.current_uses}</span>
                        </p>
                      )}
                      
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          Válido até {formatDistanceToNow(new Date(promo.valid_until), {
                            addSuffix: true,
                            locale: ptBR
                          })}
                        </span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Informações sobre Promoções */}
      <Card>
        <CardHeader>
          <CardTitle>Como Usar os Códigos Promocionais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <p>• Os códigos promocionais são aplicados automaticamente no checkout</p>
            <p>• Cada código pode ter um limite de usos e valor mínimo</p>
            <p>• Apenas um código promocional pode ser usado por transação</p>
            <p>• Códigos expirados ou esgotados não podem ser aplicados</p>
            <p>• Alguns códigos podem ser exclusivos para determinados tipos de frete</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};