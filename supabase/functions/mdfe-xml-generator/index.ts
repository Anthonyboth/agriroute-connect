/**
 * MDFe XML Generator - Utility functions for generating MDFe XMLs
 * Handles XML generation, key generation, and validation
 */

export interface MDFeData {
  numero: string;
  serie: string;
  emitente: {
    cnpj: string;
    inscricaoEstadual: string;
    rntrc: string;
    razaoSocial: string;
    nomeFantasia?: string;
    endereco: {
      logradouro: string;
      numero: string;
      bairro: string;
      codigoMunicipio: string;
      nomeMunicipio: string;
      uf: string;
      cep: string;
    };
  };
  percurso: {
    ufInicio: string;
    ufFim: string;
  };
  carregamento: {
    codigoMunicipio: string;
    nomeMunicipio: string;
  };
  descarregamento: {
    codigoMunicipio: string;
    nomeMunicipio: string;
  };
  veiculo: {
    placa: string;
    renavam: string;
    tara: number;
    capacidadeKg: number;
    tipoRodado: string;
    tipoCarroceria: string;
  };
  condutor: {
    cpf: string;
    nome: string;
  };
  documentos?: Array<{
    tipo: 'NFE' | 'CTE';
    chave: string;
    numero: string;
    serie: string;
    valor: number;
  }>;
  carga: {
    pesoKg: number;
    valor: number;
  };
  cneTest?: string;
}

/**
 * Generate MDFe access key (44 digits)
 */
export function gerarChaveAcesso(data: MDFeData): string {
  const uf = data.emitente.endereco.uf;
  const anoMes = new Date().toISOString().slice(2, 7).replace('-', ''); // AAMM
  const cnpj = data.emitente.cnpj.replace(/\D/g, '');
  const modelo = '58'; // MDFe
  const serie = data.serie.padStart(3, '0');
  const numero = data.numero.padStart(9, '0');
  const tpEmis = '1'; // Normal
  const codigo = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  
  // UF code mapping
  const ufCodes: Record<string, string> = {
    'AC': '12', 'AL': '27', 'AM': '13', 'AP': '16', 'BA': '29',
    'CE': '23', 'DF': '53', 'ES': '32', 'GO': '52', 'MA': '21',
    'MG': '31', 'MS': '50', 'MT': '51', 'PA': '15', 'PB': '25',
    'PE': '26', 'PI': '22', 'PR': '41', 'RJ': '33', 'RN': '24',
    'RO': '11', 'RR': '14', 'RS': '43', 'SC': '42', 'SE': '28',
    'SP': '35', 'TO': '17'
  };
  
  const codigoUf = ufCodes[uf.toUpperCase()] || '51';
  
  // Chave sem DV
  const chaveSemDv = codigoUf + anoMes + cnpj + modelo + serie + numero + tpEmis + codigo;
  
  // Calculate DV (digit verifier)
  const dv = calcularDigitoVerificador(chaveSemDv);
  
  return chaveSemDv + dv;
}

/**
 * Calculate digit verifier using module 11
 */
export function calcularDigitoVerificador(chave: string): string {
  let soma = 0;
  let peso = 2;
  
  for (let i = chave.length - 1; i >= 0; i--) {
    soma += parseInt(chave[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  
  const resto = soma % 11;
  const dv = resto === 0 || resto === 1 ? 0 : 11 - resto;
  
  return dv.toString();
}

/**
 * Generate complete MDFe XML
 */
export function gerarXMLMDFe(data: MDFeData, chaveAcesso: string): string {
  const dataEmissao = new Date().toISOString();
  const dhEmi = dataEmissao.replace(/\.\d{3}Z$/, '-03:00');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<MDFe xmlns="http://www.portalfiscal.inf.br/mdfe">
  <infMDFe versao="3.00" Id="MDFe${chaveAcesso}">
    <ide>
      <cUF>${chaveAcesso.substring(0, 2)}</cUF>
      <tpAmb>2</tpAmb>
      <tpEmit>1</tpEmit>
      <tpTransp>1</tpTransp>
      <mod>58</mod>
      <serie>${data.serie}</serie>
      <nMDF>${data.numero}</nMDF>
      <cMDF>${chaveAcesso.substring(35, 43)}</cMDF>
      <cDV>${chaveAcesso.substring(43)}</cDV>
      <modal>1</modal>
      <dhEmi>${dhEmi}</dhEmi>
      <tpEmis>1</tpEmis>
      <procEmi>0</procEmi>
      <verProc>1.0</verProc>
      <UFIni>${data.percurso.ufInicio}</UFIni>
      <UFFim>${data.percurso.ufFim}</UFFim>
      <infMunCarrega>
        <cMunCarrega>${data.carregamento.codigoMunicipio}</cMunCarrega>
        <xMunCarrega>${data.carregamento.nomeMunicipio}</xMunCarrega>
      </infMunCarrega>
      <infPercurso>
        <UFPer>${data.percurso.ufInicio}</UFPer>
      </infPercurso>
      <infPercurso>
        <UFPer>${data.percurso.ufFim}</UFPer>
      </infPercurso>
    </ide>
    <emit>
      <CNPJ>${data.emitente.cnpj.replace(/\D/g, '')}</CNPJ>
      <IE>${data.emitente.inscricaoEstadual}</IE>
      <xNome>${escapeXml(data.emitente.razaoSocial)}</xNome>
      ${data.emitente.nomeFantasia ? `<xFant>${escapeXml(data.emitente.nomeFantasia)}</xFant>` : ''}
      <enderEmit>
        <xLgr>${escapeXml(data.emitente.endereco.logradouro)}</xLgr>
        <nro>${escapeXml(data.emitente.endereco.numero)}</nro>
        <xBairro>${escapeXml(data.emitente.endereco.bairro)}</xBairro>
        <cMun>${data.emitente.endereco.codigoMunicipio}</cMun>
        <xMun>${escapeXml(data.emitente.endereco.nomeMunicipio)}</xMun>
        <CEP>${data.emitente.endereco.cep.replace(/\D/g, '')}</CEP>
        <UF>${data.emitente.endereco.uf}</UF>
      </enderEmit>
    </emit>
    <infModal versaoModal="3.00">
      <rodo>
        <infANTT>
          <RNTRC>${data.emitente.rntrc}</RNTRC>
          ${data.cneTest ? `<infCIOT><CIOT>${data.cneTest}</CIOT></infCIOT>` : ''}
        </infANTT>
        <veicTracao>
          <cInt>1</cInt>
          <placa>${data.veiculo.placa}</placa>
          <RENAVAM>${data.veiculo.renavam}</RENAVAM>
          <tara>${data.veiculo.tara}</tara>
          <capKG>${data.veiculo.capacidadeKg}</capKG>
          <tpRod>${getTipoRodado(data.veiculo.tipoRodado)}</tpRod>
          <tpCar>${getTipoCarroceria(data.veiculo.tipoCarroceria)}</tpCar>
          <UF>${data.emitente.endereco.uf}</UF>
        </veicTracao>
        <condutor>
          <xNome>${escapeXml(data.condutor.nome)}</xNome>
          <CPF>${data.condutor.cpf.replace(/\D/g, '')}</CPF>
        </condutor>
      </rodo>
    </infModal>
    <infDoc>
      <infMunDescarga>
        <cMunDescarga>${data.descarregamento.codigoMunicipio}</cMunDescarga>
        <xMunDescarga>${escapeXml(data.descarregamento.nomeMunicipio)}</xMunDescarga>
        ${gerarDocumentos(data.documentos || [])}
      </infMunDescarga>
    </infDoc>
    <tot>
      <qCTe>${data.documentos?.length || 0}</qCTe>
      <qNFe>${data.documentos?.filter(d => d.tipo === 'NFE').length || 0}</qNFe>
      <vCarga>${data.carga.valor.toFixed(2)}</vCarga>
      <cUnid>01</cUnid>
      <qCarga>${(data.carga.pesoKg / 1000).toFixed(4)}</qCarga>
    </tot>
  </infMDFe>
</MDFe>`;
}

/**
 * Generate encerramento event XML
 */
export function gerarEventoEncerramento(
  chaveAcesso: string,
  protocolo: string | null,
  uf: string,
  municipioCodigo: string
): string {
  const dataEvento = new Date().toISOString().replace(/\.\d{3}Z$/, '-03:00');
  const nSeqEvento = '1';
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<eventoMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00">
  <infEvento Id="ID110111${chaveAcesso}${nSeqEvento.padStart(2, '0')}">
    <cOrgao>${chaveAcesso.substring(0, 2)}</cOrgao>
    <tpAmb>2</tpAmb>
    <CNPJ>${chaveAcesso.substring(6, 20)}</CNPJ>
    <chMDFe>${chaveAcesso}</chMDFe>
    <dhEvento>${dataEvento}</dhEvento>
    <tpEvento>110111</tpEvento>
    <nSeqEvento>${nSeqEvento}</nSeqEvento>
    <detEvento versaoEvento="3.00">
      <evEncMDFe>
        <descEvento>Encerramento</descEvento>
        ${protocolo ? `<nProt>${protocolo}</nProt>` : ''}
        <dtEnc>${new Date().toISOString().split('T')[0]}</dtEnc>
        <cUF>${chaveAcesso.substring(0, 2)}</cUF>
        <cMun>${municipioCodigo}</cMun>
      </evEncMDFe>
    </detEvento>
  </infEvento>
</eventoMDFe>`;
}

/**
 * Generate cancelamento event XML
 */
export function gerarEventoCancelamento(
  chaveAcesso: string,
  protocolo: string | null,
  justificativa: string
): string {
  const dataEvento = new Date().toISOString().replace(/\.\d{3}Z$/, '-03:00');
  const nSeqEvento = '1';
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<eventoMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00">
  <infEvento Id="ID110111${chaveAcesso}${nSeqEvento.padStart(2, '0')}">
    <cOrgao>${chaveAcesso.substring(0, 2)}</cOrgao>
    <tpAmb>2</tpAmb>
    <CNPJ>${chaveAcesso.substring(6, 20)}</CNPJ>
    <chMDFe>${chaveAcesso}</chMDFe>
    <dhEvento>${dataEvento}</dhEvento>
    <tpEvento>110111</tpEvento>
    <nSeqEvento>${nSeqEvento}</nSeqEvento>
    <detEvento versaoEvento="3.00">
      <evCancMDFe>
        <descEvento>Cancelamento</descEvento>
        ${protocolo ? `<nProt>${protocolo}</nProt>` : ''}
        <xJust>${escapeXml(justificativa)}</xJust>
      </evCancMDFe>
    </detEvento>
  </infEvento>
</eventoMDFe>`;
}

// Helper functions
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getTipoRodado(tipo: string): string {
  const mapping: Record<string, string> = {
    'TRUCK': '01',
    'TOCO': '02',
    'CAVALO': '03',
    'VAN': '04',
    'UTILITARIO': '05',
    'OUTROS': '06',
  };
  return mapping[tipo.toUpperCase()] || '06';
}

function getTipoCarroceria(tipo: string): string {
  const mapping: Record<string, string> = {
    'ABERTA': '00',
    'FECHADA': '01',
    'GRANELERA': '02',
    'PORTA_CONTAINER': '03',
    'SIDER': '04',
  };
  return mapping[tipo.toUpperCase()] || '01';
}

function gerarDocumentos(documentos: Array<any>): string {
  return documentos
    .map(doc => {
      if (doc.tipo === 'NFE') {
        return `<infNFe><chNFe>${doc.chave}</chNFe></infNFe>`;
      } else if (doc.tipo === 'CTE') {
        return `<infCTe><chCTe>${doc.chave}</chCTe></infCTe>`;
      }
      return '';
    })
    .join('\n        ');
}
