/**
 * VERIFICAÇÃO DO GOOGLE — a fronteira externa desta EF.
 *
 * O que importa não é o email que o token carrega solto: é o email
 * VERIFICADO pelo provedor (RN-02/RN-04 · EF-01) — o campo `email_verified`
 * do payload assinado, nunca uma alegação sem prova. A verificação em si
 * (assinatura, emissor, audiência, expiração) é inteiramente da
 * `google-auth-library`; não é reimplementada aqui.
 */
import { OAuth2Client } from 'google-auth-library';

import { ambiente } from '../../config/ambiente';

export interface PerfilGoogle {
  email: string;
  emailVerificado: boolean;
  nome: string;
}

export type VerificadorDeIdTokenGoogle = (idToken: string) => Promise<PerfilGoogle>;

async function verificarComGoogle(idToken: string): Promise<PerfilGoogle> {
  if (!ambiente.GOOGLE_CLIENT_ID) {
    throw new Error(
      'GOOGLE_CLIENT_ID não configurado — login por Google indisponível neste ambiente.',
    );
  }

  const cliente = new OAuth2Client(ambiente.GOOGLE_CLIENT_ID);
  const ticket = await cliente.verifyIdToken({
    idToken,
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

let verificador: VerificadorDeIdTokenGoogle = verificarComGoogle;

/**
 * Seam de teste: a verificação real fala com o Google pela rede e exige
 * credencial — é a fronteira externa, e é ela que se troca por um dublê (ver
 * skill de TDD: mocke o difícil de testar de verdade, não o domínio). O
 * resto do fluxo de login/aceite — rota, banco, sessão, RN-04 — continua
 * real. Só a suíte de integração chama isto.
 */
export function definirVerificadorDeIdTokenGoogle(fn: VerificadorDeIdTokenGoogle): void {
  verificador = fn;
}

/** Devolve o verificador ao comportamento real. Chame no `afterEach`/`afterAll` do teste. */
export function restaurarVerificadorDeIdTokenGoogle(): void {
  verificador = verificarComGoogle;
}

export async function verificarIdTokenGoogle(idToken: string): Promise<PerfilGoogle> {
  return verificador(idToken);
}
