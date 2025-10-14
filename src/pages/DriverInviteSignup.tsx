import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function DriverInviteSignup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("inviteToken");

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<{
    transportadora_id: string;
    transportadora_nome: string;
    empresa_nome: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    cpf_cnpj: "",
    password: "",
    confirmPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setErrorMessage("Link de convite inválido");
      setValidating(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("validar-token-convite", {
        body: { token },
      });

      if (error) throw error;

      if (data.valid) {
        setTokenValid(true);
        setCompanyInfo({
          transportadora_id: data.transportadora_id,
          transportadora_nome: data.transportadora_nome,
          empresa_nome: data.empresa_nome,
        });
      } else {
        setErrorMessage(data.message || "Convite inválido ou expirado");
      }
    } catch (error: any) {
      console.error("Erro ao validar token:", error);
      setErrorMessage("Erro ao validar convite. Tente novamente.");
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("processar-cadastro-motorista", {
        body: {
          token,
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          cpf_cnpj: formData.cpf_cnpj,
          password: formData.password,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Cadastro realizado com sucesso!");
        
        // Fazer login automático
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (signInError) {
          toast.error("Cadastro realizado, mas houve erro no login. Faça login manualmente.");
          navigate("/auth");
        } else {
          navigate("/dashboard/driver");
        }
      } else {
        toast.error(data.error || "Erro ao realizar cadastro");
      }
    } catch (error: any) {
      console.error("Erro ao cadastrar:", error);
      toast.error(error.message || "Erro ao realizar cadastro. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Validando convite...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
            <Button className="w-full mt-4" onClick={() => navigate("/")}>
              Voltar para página inicial
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Cadastro de Motorista Afiliado</CardTitle>
          <CardDescription>
            Você foi convidado pela transportadora <strong>{companyInfo?.empresa_nome}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="full_name">Nome Completo *</Label>
              <Input
                id="full_name"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="phone">Telefone *</Label>
              <Input
                id="phone"
                required
                placeholder="(00) 00000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="cpf_cnpj">CPF/CNPJ *</Label>
              <Input
                id="cpf_cnpj"
                required
                placeholder="000.000.000-00"
                value={formData.cpf_cnpj}
                onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="password">Senha *</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                minLength={6}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              />
            </div>

            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Ao completar o cadastro, você será automaticamente vinculado à transportadora.
              </AlertDescription>
            </Alert>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                "Completar Cadastro"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
