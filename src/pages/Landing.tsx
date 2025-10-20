import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import AuthModal from '@/components/AuthModal';
import MudancaModal from '@/components/MudancaModal';
import GuestServiceModal from '@/components/GuestServiceModal';
import HowItWorksModal from '@/components/HowItWorksModal';
import { FreightTransportModal } from '@/components/FreightTransportModal';
import { ServicesModal } from '@/components/ServicesModal';
import ServiceRequestModal from '@/components/ServiceRequestModal';
import { ContactModal } from '@/components/ContactModal';
import ReportModal from '@/components/ReportModal';
import { Truck, Users, MapPin, Star, ArrowRight, Leaf, Shield, Clock, Wrench, Home, MessageCircle, Mail, CheckCircle2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import heroImage from '@/assets/hero-logistics.jpg';
import agriRouteLogo from '@/assets/agriroute-full-logo.png';
import { supabase } from '@/integrations/supabase/client';
import Autoplay from "embla-carousel-autoplay";
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem 
} from "@/components/ui/carousel";
import { PlatformStatsSection } from '@/components/PlatformStatsSection';

const Landing = () => {
  const navigate = useNavigate();
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; initialTab?: 'login' | 'signup' }>({
    isOpen: false,
  });
  
  const partners = [
    { id: 1, name: 'AgriRoute', logo: agriRouteLogo },
    { id: 2, name: 'Parceiro 2', logo: null },
    { id: 3, name: 'Parceiro 3', logo: null },
    { id: 4, name: 'Parceiro 4', logo: null },
    { id: 5, name: 'Parceiro 5', logo: null },
    { id: 6, name: 'Parceiro 6', logo: null },
    { id: 7, name: 'Parceiro 7', logo: null },
    { id: 8, name: 'Parceiro 8', logo: null },
    { id: 9, name: 'Parceiro 9', logo: null },
    { id: 10, name: 'Parceiro 10', logo: null },
  ];
  
  // Filtrar apenas parceiros com logo
  const partnersWithLogo = partners.filter(partner => partner.logo !== null);
  
  const [mudancaModal, setMudancaModal] = useState(false);
  const [guestServiceModal, setGuestServiceModal] = useState<{ isOpen: boolean; serviceType?: 'GUINCHO' | 'MUDANCA' | 'FRETE_URBANO' }>({
    isOpen: false,
  });
  const [servicesModal, setServicesModal] = useState(false);
  const [freightTransportModal, setFreightTransportModal] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [howItWorksModal, setHowItWorksModal] = useState<{ isOpen: boolean; userType?: 'PRODUTOR' | 'MOTORISTA' }>({
    isOpen: false,
  });
  const [contactModal, setContactModal] = useState(false);
  const [reportModal, setReportModal] = useState(false);

  const handleGetStarted = (userType: 'PRODUTOR' | 'MOTORISTA') => {
    setHowItWorksModal({ isOpen: true, userType });
  };

  const closeHowItWorksModal = () => {
    setHowItWorksModal({ isOpen: false });
  };

  const handleProceedToDashboard = () => {
    const userType = howItWorksModal.userType;
    if (userType) {
      const route = userType === 'PRODUTOR' ? '/dashboard/producer' : '/dashboard/driver';
      navigate(route);
    }
    closeHowItWorksModal();
  };

  const openAuthModal = (initialTab?: 'login' | 'signup') => {
    setAuthModal({ isOpen: true, initialTab });
  };

  const closeAuthModal = () => {
    setAuthModal({ isOpen: false });
  };

  const handleServiceSelect = (service: any) => {
    setSelectedService(service);
    setServicesModal(false);
    setTimeout(() => setRequestModalOpen(true), 0);
  };

  const { profiles, switchProfile, session, isAuthenticated } = useAuth();
  const redirectedRef = useRef(false);
  // Redirecionamento prioritário por querystring (para links de convite)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const inviteCode = searchParams.get('invite');
    const affiliateCompanyId = searchParams.get('cadastro_afiliado');
    const inviteToken = searchParams.get('inviteToken');

    if (inviteCode) {
      navigate(`/company-invite/${inviteCode}`, { replace: true });
      return;
    }

    if (affiliateCompanyId) {
      navigate(`/cadastro-afiliado/${affiliateCompanyId}`, { replace: true });
      return;
    }

    if (inviteToken) {
      navigate(`/cadastro-motorista?inviteToken=${encodeURIComponent(inviteToken)}`, { replace: true });
      return;
    }
  }, [navigate]);

  // Auto-switch para TRANSPORTADORA quando houver perfil TRANSPORTADORA
  useEffect(() => {
    if (redirectedRef.current) return;
    if (!session?.user?.id) return;

    let cancelled = false;

    const checkAndRedirect = async () => {
      try {
        // Buscar perfil TRANSPORTADORA se houver múltiplos perfis
        const transportProfile = profiles.find(p => p.role === 'TRANSPORTADORA');
        if (transportProfile && !cancelled) {
          // Verificar se existe registro em transport_companies
          const { data: company } = await supabase
            .from('transport_companies')
            .select('id')
            .eq('profile_id', transportProfile.id)
            .maybeSingle();

          if (company && !cancelled) {
            redirectedRef.current = true;
            switchProfile(transportProfile.id);
            navigate('/dashboard/company', { replace: true });
            return;
          }
        }

        // Verificar perfil atual
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, active_mode')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!profile || cancelled) return;

        // Verificar se é transportadora pelo active_mode ou por registro
        const { data: currentCompany } = await supabase
          .from('transport_companies')
          .select('id')
          .eq('profile_id', profile.id)
          .maybeSingle();

        if ((currentCompany || profile.active_mode === 'TRANSPORTADORA') && !cancelled) {
          redirectedRef.current = true;
          navigate('/dashboard/company', { replace: true });
        }
      } catch (e) {
        // Ignore errors to avoid blocking UI
      }
    };

    checkAndRedirect();

    return () => { cancelled = true; };
  }, [navigate, switchProfile, session?.user?.id, profiles]);

  const features = [
    {
      icon: Truck,
      title: 'Logística Inteligente',
      description: 'Conecte produtores e transportadores de forma eficiente e segura.'
    },
    {
      icon: MapPin,
      title: 'Rastreamento em Tempo Real',
      description: 'Acompanhe suas cargas em tempo real com nossa tecnologia avançada.'
    },
    {
      icon: Shield,
      title: 'Transações Seguras',
      description: 'Pagamentos protegidos e contratos digitais para sua tranquilidade.'
    },
    {
      icon: Clock,
      title: 'Entrega Pontual',
      description: 'Otimização de rotas para garantir entregas no prazo.'
    }
  ];


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Leaf className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">AgriRoute</span>
            </div>
            <ThemeToggle />
          </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-smooth">
                Recursos
              </a>
              <Link to="/sobre" className="text-muted-foreground hover:text-foreground transition-smooth">
                Sobre
              </Link>
              <button 
                onClick={() => setContactModal(true)}
                className="text-muted-foreground hover:text-foreground transition-smooth"
              >
                Contato
              </button>
            </nav>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => navigate('/auth')}> 
                Entrar
              </Button>
              <Button onClick={() => navigate('/auth')} className="gradient-primary text-primary-foreground">
                Cadastrar-se
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setServicesModal(true)}
                className="hidden lg:flex"
              >
                Solicitar Serviço
              </Button>
            </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
        <div
