import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Users, Heart, Lightbulb, Target, Mail, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Careers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [applicationModal, setApplicationModal] = useState(false);
  const [applicationData, setApplicationData] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    experience: '',
    motivation: '',
    resume: null as File | null
  });

  const jobOpenings = [
    {
      id: 1,
      title: "Desenvolvedor Full Stack",
      department: "Tecnologia",
      location: "Cuiabá, MT / Remoto",
      type: "CLT",
      level: "Pleno",
      description: "Buscamos um desenvolvedor experiente em React, Node.js e banco de dados para expandir nossa plataforma.",
      requirements: ["3+ anos em desenvolvimento web", "React e TypeScript", "Node.js e PostgreSQL", "Experiência com APIs REST"],
      benefits: ["Salário competitivo", "Plano de saúde", "Vale alimentação", "Flexibilidade de horário"]
    },
    {
      id: 2,
      title: "Especialista em Agronegócio",
      department: "Produto",
      location: "Campo Grande, MS",
      type: "CLT",
      level: "Senior",
      description: "Profissional com experiência no agronegócio para liderar estratégias de produto e relacionamento com clientes.",
      requirements: ["Formação em Agronomia ou áreas afins", "5+ anos no agronegócio", "Conhecimento em logística", "Inglês fluente"],
      benefits: ["Salário competitivo", "Carro da empresa", "Plano de saúde premium", "Participação nos lucros"]
    },
    {
      id: 3,
      title: "Analista de Marketing Digital",
      department: "Marketing",
      location: "Remoto",
      type: "CLT",
      level: "Júnior",
      description: "Oportunidade para crescer na área de marketing digital, focando em campanhas para o agronegócio.",
      requirements: ["Formação em Marketing ou área relacionada", "Conhecimento em Google Ads e Facebook Ads", "Experiência com Analytics", "Criatividade e proatividade"],
      benefits: ["Salário competitivo", "Vale alimentação", "Cursos e certificações", "Horário flexível"]
    }
  ];

  const values = [
    {
      icon: Heart,
      title: "Paixão pelo Agro",
      description: "Acreditamos no potencial do agronegócio brasileiro e trabalhamos com dedicação para impulsionar o setor."
    },
    {
      icon: Lightbulb,
      title: "Inovação",
      description: "Buscamos constantemente novas soluções tecnológicas para revolucionar a logística agrícola."
    },
    {
      icon: Users,
      title: "Colaboração",
      description: "Valorizamos o trabalho em equipe e a troca de conhecimentos entre nossos colaboradores."
    },
    {
      icon: Target,
      title: "Resultados",
      description: "Focamos na entrega de valor real para nossos clientes e no crescimento sustentável da empresa."
    }
  ];

  const handleApplicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simulate application submission
    toast({
      title: "Candidatura enviada!",
      description: "Sua candidatura foi recebida com sucesso. Entraremos em contato em breve.",
    });
    
    setApplicationModal(false);
    setApplicationData({
      name: '',
      email: '',
      phone: '',
      position: '',
      experience: '',
      motivation: '',
      resume: null
    });
  };

  const openApplication = (job: any) => {
    setSelectedJob(job);
    setApplicationData(prev => ({ ...prev, position: job.title }));
    setApplicationModal(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Início
          </Button>
          <h1 className="text-2xl font-bold">Carreiras</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 gradient-hero bg-clip-text text-transparent">
            Construa o Futuro do Agronegócio
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Junte-se à nossa equipe e ajude a revolucionar a logística agrícola brasileira. 
            Estamos em busca de talentos apaixonados por tecnologia e agronegócio.
          </p>
        </div>

        {/* Company Values */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Nossos Valores</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <Card key={index} className="text-center hover:shadow-glow transition-shadow">
                  <CardContent className="p-6">
                    <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      <Icon className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-3">{value.title}</h3>
                    <p className="text-muted-foreground text-sm">{value.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Job Openings */}
        <section className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Vagas Abertas</h2>
            <p className="text-muted-foreground">Encontre a oportunidade perfeita para sua carreira</p>
          </div>
          
          <div className="space-y-6">
            {jobOpenings.map((job) => (
              <Card key={job.id} className="hover:shadow-glow transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <h3 className="text-xl font-semibold">{job.title}</h3>
                        <Badge variant="secondary">{job.level}</Badge>
                        <Badge variant="outline">{job.type}</Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-muted-foreground text-sm mb-4">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {job.department}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {job.location}
                        </span>
                      </div>
                      
                      <p className="text-muted-foreground mb-4">{job.description}</p>
                      
                      <div className="flex flex-wrap gap-2">
                        {job.requirements.slice(0, 3).map((req, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {req}
                          </Badge>
                        ))}
                        {job.requirements.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{job.requirements.length - 3} mais
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-6 lg:mt-0 lg:ml-6">
                      <Button 
                        onClick={() => openApplication(job)}
                        className="gradient-primary text-primary-foreground w-full lg:w-auto"
                      >
                        Candidatar-se
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Benefits Section */}
        <section className="mb-16">
          <Card className="bg-gradient-to-r from-primary/5 to-secondary/5">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold mb-6">Por que trabalhar na AgriRoute?</h2>
              <div className="grid md:grid-cols-3 gap-8 mt-8">
                <div>
                  <Heart className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Ambiente Acolhedor</h3>
                  <p className="text-muted-foreground">Cultura colaborativa e inclusiva onde todos podem crescer</p>
                </div>
                <div>
                  <Target className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Crescimento Profissional</h3>
                  <p className="text-muted-foreground">Oportunidades de desenvolvimento e progressão na carreira</p>
                </div>
                <div>
                  <Lightbulb className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Inovação Constante</h3>
                  <p className="text-muted-foreground">Trabalhe com as mais modernas tecnologias do mercado</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Contact Section */}
        <section className="text-center">
          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">Não encontrou a vaga ideal?</h2>
              <p className="text-muted-foreground mb-6">
                Envie seu currículo e nos conte sobre seu interesse em fazer parte da nossa equipe.
              </p>
              <Button variant="outline" className="flex items-center gap-2 mx-auto">
                <Mail className="h-4 w-4" />
                rh@agriroute.com.br
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Application Modal */}
      <Dialog open={applicationModal} onOpenChange={setApplicationModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Candidatar-se para: {selectedJob?.title}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleApplicationSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  value={applicationData.name}
                  onChange={(e) => setApplicationData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={applicationData.email}
                  onChange={(e) => setApplicationData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={applicationData.phone}
                onChange={(e) => setApplicationData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="experience">Experiência Profissional *</Label>
              <Textarea
                id="experience"
                placeholder="Descreva sua experiência relevante para esta posição..."
                value={applicationData.experience}
                onChange={(e) => setApplicationData(prev => ({ ...prev, experience: e.target.value }))}
                rows={4}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="motivation">Por que você quer trabalhar conosco? *</Label>
              <Textarea
                id="motivation"
                placeholder="Conte-nos sobre sua motivação..."
                value={applicationData.motivation}
                onChange={(e) => setApplicationData(prev => ({ ...prev, motivation: e.target.value }))}
                rows={3}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="resume">Currículo (PDF) *</Label>
              <Input
                id="resume"
                type="file"
                accept=".pdf"
                onChange={(e) => setApplicationData(prev => ({ ...prev, resume: e.target.files?.[0] || null }))}
                required
              />
            </div>
            
            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => setApplicationModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="gradient-primary text-primary-foreground">
                Enviar Candidatura
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Careers;