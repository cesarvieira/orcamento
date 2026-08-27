/**
 * A FRONTEIRA COM O GOOGLE — onde um código de autorização vira uma pessoa.
 *
 * O que importa não é o email que chega solto: é o email VERIFICADO pelo
 * provedor (RN-02/RN-04 · EF-01) — o campo `email_verified` de um payload
 * ASSINADO, nunca uma alegação sem prova.
 *
 * ## Por que código de autorização, e não ID token direto
 *
 * O fluxo anterior pedia o ID token ao navegador pelo One Tap
 * (`google.accounts.id.prompt`). One Tap só aparece para quem JÁ tem sessão
 * Google aberta no navegador — quem não tem recebe "not signed in with the
 * identity provider" e fica sem caminho nenhum para entrar. Não existe forma
 * suportada de abrir o seletor de conta a partir de um botão nosso naquele
 * fluxo: quem abre é o botão que o próprio Google renderiza.
 *
 * O fluxo de CÓDIGO (`google.accounts.oauth2.initCodeClient`) pode ser
 * disparado do nosso botão, e funciona mesmo sem sessão Google prévia. O
 * preço é este arquivo: o navegador devolve um código de uso único, e é a API
 * que o troca por tokens — troca que exige o client SECRET, e por isso só
 * pode acontecer aqui, nunca no front.
 *
 * A troca e a verificação são inteiramente da `google-auth-library`; nada de
 * criptografia é reimplementado aqui.
 */
import { OAuth2Client } from 'google-auth-library';

import { ambiente } from '../../config/ambiente';

export interface PerfilGoogle {
  email: string;
  emailVerificado: boolean;
  nome: string;
}

export type ResolvedorDeGoogle = (codigoAutorizacao: string) => Promise<PerfilGoogle>;

/**
 * `postmessage` não é uma URL de verdade: é o valor que o Google exige como
 * `redirect_uri` quando o código veio de um cliente em modo POPUP, que é o
 * nosso caso. Trocar por uma URL real faz o Google recusar com
 * `redirect_uri_mismatch`.
 */
const REDIRECT_URI_DO_POPUP = 'postmessage';

async function resolverComGoogle(codigoAutorizacao: string): Promise<PerfilGoogle> {
  if (!ambiente.GOOGLE_CLIENT_ID || !ambiente.GOOGLE_CLIENT_SECRET) {
    throw new Error(
      'GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados — login por Google ' +
      'indisponível neste ambiente.',
    );
  }

  const cliente = new OAuth2Client(
    ambiente.GOOGLE_CLIENT_ID,
    ambiente.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI_DO_POPUP,
  );

  const { tokens } = await cliente.getToken(codigoAutorizacao);
  if (!tokens.id_token) {
    throw new Error('o Google não devolveu ID token na troca do código');
  }

  // Trocar o código já prova que falamos com o Google, mas o ID token ainda é
  // verificado: é ele que carrega `email_verified`, e conferir a assinatura e
  // a audiência custa nada perto de aceitar um payload sem checar.
  const ticket = await cliente.verifyIdToken({
    idToken: tokens.id_token,
    audience: ambiente.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new Error('token do Google sem email no payload');
  }

  return {
    email: payload.email.trim().toLowerCase(),
    emailVerificado: payload.email_verified === true,
    nome: payload.name?.trim() || payload.email,
  };
}

let resolvedor: ResolvedorDeGoogle = resolverComGoogle;

/**
 * Seam de teste: a resolução real fala com o Google pela rede e exige
 * credencial — é a fronteira externa, e é ela que se troca por um dublê (ver
 * skill de TDD: mocke o difícil de testar de verdade, não o domínio). O
 * resto do fluxo de login/aceite — rota, banco, sessão, RN-04 — continua
 * real. Só a suíte de integração chama isto.
 */
export function definirResolvedorDeGoogle(fn: ResolvedorDeGoogle): void {
  resolvedor = fn;
}

/** Devolve o resolvedor ao comportamento real. Chame no `afterEach`/`afterAll` do teste. */
export function restaurarResolvedorDeGoogle(): void {
  resolvedor = resolverComGoogle;
}

export async function perfilDoGoogle(codigoAutorizacao: string): Promise<PerfilGoogle> {
  return resolvedor(codigoAutorizacao);
}
