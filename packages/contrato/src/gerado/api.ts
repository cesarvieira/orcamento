/**
 * ⚠️ ARQUIVO GERADO — NÃO EDITE.
 *
 * Sai de `packages/contrato/gerar.mjs`, a partir do OpenAPI que a API publica.
 * Editar aqui é criar a segunda declaração do modelo — exatamente o que o
 * contrato gerado existe para impedir (D-03). Mude o Zod da API e regenere:
 *
 *   pnpm run contrato:gerar
 */

export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Estado da API e do banco */
        get: operations["get_health"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sessoes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Abre uma sessão com email e senha */
        post: operations["post_sessoes"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sessoes/google": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Abre uma sessão com um ID token do Google */
        post: operations["post_sessoes_google"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sessoes/atual": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** A sessão corrente, derivada do cookie */
        get: operations["get_sessoes_atual"];
        put?: never;
        post?: never;
        /** Encerra a sessão corrente */
        delete: operations["delete_sessoes_atual"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/familia": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** A família da sessão, com seus membros */
        get: operations["get_familia"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/convites": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Os convites pendentes da família da sessão */
        get: operations["get_convites"];
        put?: never;
        /** Convida um novo membro para a família da sessão */
        post: operations["post_convites"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/convites/{token}/aceitar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Aceita um convite e abre sessão na família dele */
        post: operations["post_convites__token__aceitar"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Erro: {
            /** @description Código estável do erro, legível por máquina. */
            erro: string;
            /** @description Texto para a pessoa. */
            mensagem: string;
        };
        Saude: {
            /** @enum {string} */
            estado: "ok" | "degradado";
            /** @enum {string} */
            banco: "ok" | "indisponivel";
            versao: string;
        };
        Credenciais: {
            email: string;
            senha: string;
        };
        MembroDaFamilia: {
            id: string;
            nome: string;
            email: string;
        };
        SessaoAtual: {
            membroId: string;
            membroNome: string;
            membroEmail: string;
            familiaId: string;
            familiaNome: string;
        };
        FamiliaAtual: {
            id: string;
            nome: string;
            membros: {
                id: string;
                nome: string;
                email: string;
            }[];
        };
        Invalidacao: {
            /** @description Que família de leitura ficou velha. Ex.: "lancamentos". */
            recurso: string;
            /** @description Competência afetada, AAAA-MM. Nulo quando não é mensal. */
            competencia: string | null;
            /** @description Quem provocou a mudança. O cliente descarta o próprio eco (R5). */
            origemClienteId: string | null;
        };
        LoginGoogle: {
            /** @description O ID token que o Google Identity Services devolveu ao cliente. */
            idToken: string;
        };
        CriarConvite: {
            email: string;
        };
        ConviteCriado: {
            id: string;
            email: string;
            /** @description ISO 8601 — quando o convite deixa de valer (RN-03). */
            expiraEm: string;
        };
        ConvitePendente: {
            id: string;
            email: string;
            /** @description ISO 8601 — quando o convite deixa de valer (RN-03). */
            expiraEm: string;
        };
        ConvitesPendentes: {
            convites: {
                id: string;
                email: string;
                /** @description ISO 8601 — quando o convite deixa de valer (RN-03). */
                expiraEm: string;
            }[];
        };
        AceitarConvite: {
            /** @enum {string} */
            metodo: "senha";
            nome: string;
            email: string;
            senha: string;
        } | {
            /** @enum {string} */
            metodo: "google";
            idToken: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    get_health: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A API responde e o banco está acessível */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Saude"];
                };
            };
            /** @description A API responde mas o banco não */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Saude"];
                };
            };
        };
    };
    post_sessoes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Credenciais"];
            };
        };
        responses: {
            /** @description Sessão aberta; cookie httpOnly definido */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessaoAtual"];
                };
            };
            /** @description Email ou senha não conferem */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Corpo inválido */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
        };
    };
    post_sessoes_google: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginGoogle"];
            };
        };
        responses: {
            /** @description Sessão aberta; cookie httpOnly definido */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessaoAtual"];
                };
            };
            /** @description Token inválido, email não verificado ou sem conta */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Corpo inválido */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
        };
    };
    get_sessoes_atual: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A sessão corrente */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessaoAtual"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
        };
    };
    delete_sessoes_atual: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sessão encerrada */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
        };
    };
    get_familia: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A família da sessão */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FamiliaAtual"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
        };
    };
    get_convites: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Os convites pendentes */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConvitesPendentes"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
        };
    };
    post_convites: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CriarConvite"];
            };
        };
        responses: {
            /** @description Convite criado e despachado por email */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConviteCriado"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Corpo inválido */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
        };
    };
    post_convites__token__aceitar: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AceitarConvite"];
            };
        };
        responses: {
            /** @description Convite aceito; sessão aberta */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessaoAtual"];
                };
            };
            /** @description Token do Google inválido ou email não verificado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Email divergente do convidado (RN-02) */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Convite inexistente */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Convite já usado, ou email de outra família */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Convite expirado (RN-03) */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Corpo inválido */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
        };
    };
}
