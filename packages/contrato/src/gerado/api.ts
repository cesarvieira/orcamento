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
        /** Abre uma sessão com um código de autorização do Google */
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
    "/convites/aceitar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Aceita um convite e abre sessão na família dele */
        post: operations["post_convites_aceitar"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/cadastros": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cria uma família nova e envia a confirmação de email */
        post: operations["post_cadastros"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/cadastros/confirmar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Confirma o email do cadastro e abre a sessão */
        post: operations["post_cadastros_confirmar"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/convites/recusar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Recusa um convite pendente */
        post: operations["post_convites_recusar"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/recuperacoes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Pede o código que troca a senha esquecida */
        post: operations["post_recuperacoes"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/recuperacoes/concluir": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Troca a senha com o código recebido e abre a sessão */
        post: operations["post_recuperacoes_concluir"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/contas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** As contas da família da sessão, com saldo derivado */
        get: operations["get_contas"];
        put?: never;
        /** Cria uma conta (DEBITO, CREDITO ou RESERVA) na família da sessão */
        post: operations["post_contas"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/contas/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Exclui uma conta da família da sessão, se ela não tiver lançamentos (RN-06) */
        delete: operations["delete_contas__id_"];
        options?: never;
        head?: never;
        /** Atualiza uma conta da família da sessão (substitui os dados do tipo) */
        patch: operations["patch_contas__id_"];
        trace?: never;
    };
    "/categorias": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** As categorias da família da sessão (nome, ícone, cor — sem valor) */
        get: operations["get_categorias"];
        put?: never;
        /** Cria uma categoria (envelope de gasto) na família da sessão */
        post: operations["post_categorias"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/categorias/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Apaga uma categoria da família da sessão (leva junto teto e histórico) */
        delete: operations["delete_categorias__id_"];
        options?: never;
        head?: never;
        /** Atualiza nome, ícone e cor de uma categoria da família da sessão */
        patch: operations["patch_categorias__id_"];
        trace?: never;
    };
    "/competencias/{competencia}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** A leitura de uma competência: renda prevista, planejado, recebido, não alocado e as categorias com teto/gasto/disponível */
        get: operations["get_competencias__competencia_"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/competencias/{competencia}/renda-prevista": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Define a renda prevista da competência (referência de planejamento — RN-12: não é teto) */
        put: operations["put_competencias__competencia__renda_prevista"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/competencias/{competencia}/categorias/{categoriaId}/teto": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Define o teto de UMA categoria NESTA competência (RN-09) — cria ou substitui a linha de OrcamentoMes */
        put: operations["put_competencias__competencia__categorias__categoriaId__teto"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/competencias/{competencia}/remanejamentos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Remaneja teto de uma categoria de origem para uma de destino, NESTA competência (RN-13). Sem trava (RN-14). */
        post: operations["post_competencias__competencia__remanejamentos"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/lancamentos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lista os lançamentos da família da sessão (extrato), com filtro opcional de competência e conta */
        get: operations["get_lancamentos"];
        put?: never;
        /** Registra um lançamento (RECEITA, DESPESA ou TRANSFERENCIA) na família da sessão. DESPESA com quantidadeParcelas > 1 gera uma SerieParcelas e N lançamentos (RN-20/RN-21). */
        post: operations["post_lancamentos"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/lancamentos/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** O detalhe de um lançamento da família da sessão */
        get: operations["get_lancamentos__id_"];
        put?: never;
        post?: never;
        /** Apaga um lançamento da família da sessão. ?modo escolhe o alcance quando ele é parcela de uma série: esta (default) · todas · a-partir-desta (fork 1/#52) */
        delete: operations["delete_lancamentos__id_"];
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
            /** @description O código de autorização de uso único que o Google devolveu ao navegador. Quem o troca por um ID token é a API, porque a troca exige o client secret. */
            codigoAutorizacao: string;
        };
        CriarConvite: {
            email: string;
        };
        CriarConta: {
            /** @description Como a família se chama no app. */
            familiaNome: string;
            nome: string;
            email: string;
            /** @description Mínimo de 8 caracteres. */
            senha: string;
        };
        ConfirmarConta: {
            email: string;
            codigo: string;
        };
        PedirRecuperacao: {
            email: string;
        };
        ConcluirRecuperacao: {
            email: string;
            codigo: string;
            /** @description Mínimo de 8 caracteres. */
            senha: string;
        };
        RecuperacaoPedida: {
            /** @description Texto idêntico exista ou não a conta. */
            mensagem: string;
        };
        RecusarConvite: {
            email: string;
            codigo: string;
        };
        ContaCriada: {
            /** @description Para onde o email de confirmação foi enviado. */
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
            codigo: string;
            nome: string;
            email: string;
            senha: string;
        } | {
            /** @enum {string} */
            metodo: "google";
            codigo: string;
            codigoAutorizacao: string;
        };
        NovaConta: {
            /** @enum {string} */
            tipo: "DEBITO";
            /** @description Nome da conta, escolhido pela família. */
            nome: string;
            icone: string;
            cor: string;
            saldoInicialCentavos: number;
        } | {
            /** @enum {string} */
            tipo: "RESERVA";
            /** @description Nome da conta, escolhido pela família. */
            nome: string;
            icone: string;
            cor: string;
            saldoInicialCentavos: number;
        } | {
            /** @enum {string} */
            tipo: "CREDITO";
            /** @description Nome da conta, escolhido pela família. */
            nome: string;
            icone: string;
            cor: string;
            limiteCentavos: number;
            /** @description Dia do mês, 1–28 (RN-08): dia 29–31 não existe em todo mês. */
            diaFechamento: number;
            /** @description Dia do mês, 1–28 (RN-08): dia 29–31 não existe em todo mês. */
            diaVencimento: number;
        };
        AtualizarConta: {
            /** @enum {string} */
            tipo: "DEBITO";
            /** @description Nome da conta, escolhido pela família. */
            nome: string;
            icone: string;
            cor: string;
            saldoInicialCentavos: number;
        } | {
            /** @enum {string} */
            tipo: "RESERVA";
            /** @description Nome da conta, escolhido pela família. */
            nome: string;
            icone: string;
            cor: string;
            saldoInicialCentavos: number;
        } | {
            /** @enum {string} */
            tipo: "CREDITO";
            /** @description Nome da conta, escolhido pela família. */
            nome: string;
            icone: string;
            cor: string;
            limiteCentavos: number;
            /** @description Dia do mês, 1–28 (RN-08): dia 29–31 não existe em todo mês. */
            diaFechamento: number;
            /** @description Dia do mês, 1–28 (RN-08): dia 29–31 não existe em todo mês. */
            diaVencimento: number;
        };
        Conta: {
            id: string;
            /** @enum {string} */
            tipo: "DEBITO" | "CREDITO" | "RESERVA";
            nome: string;
            icone: string;
            cor: string;
            saldoInicialCentavos: number | null;
            limiteCentavos: number | null;
            diaFechamento: number | null;
            diaVencimento: number | null;
            /** @description Derivado: saldoInicialCentavos + Σ lançamentos da conta (EF-02 §1). Nunca materializado. */
            saldoCentavos: number;
        };
        ContasListadas: {
            contas: {
                id: string;
                /** @enum {string} */
                tipo: "DEBITO" | "CREDITO" | "RESERVA";
                nome: string;
                icone: string;
                cor: string;
                saldoInicialCentavos: number | null;
                limiteCentavos: number | null;
                diaFechamento: number | null;
                diaVencimento: number | null;
                /** @description Derivado: saldoInicialCentavos + Σ lançamentos da conta (EF-02 §1). Nunca materializado. */
                saldoCentavos: number;
            }[];
            totalEmContaHojeCentavos: number;
        };
        NovaCategoria: {
            /** @description Nome da categoria, escolhido pela família. */
            nome: string;
            icone: string;
            cor: string;
        };
        AtualizarCategoria: {
            /** @description Nome da categoria, escolhido pela família. */
            nome: string;
            icone: string;
            cor: string;
        };
        /** @description O envelope de gasto — sem valor (RN-09). O teto é leitura da competência. */
        Categoria: {
            id: string;
            /** @description Nome da categoria, escolhido pela família. */
            nome: string;
            icone: string;
            cor: string;
        };
        CategoriasListadas: {
            categorias: {
                id: string;
                /** @description Nome da categoria, escolhido pela família. */
                nome: string;
                icone: string;
                cor: string;
            }[];
        };
        DefinirTeto: {
            /** @description Teto em centavos (D-06). Definido diretamente aqui é sempre ≥ 0. */
            tetoCentavos: number;
        };
        OrcamentoMesLido: {
            categoriaId: string;
            /** @description AAAA-MM. */
            competencia: string;
            /** @description Pode ser negativo aqui: um remanejamento (RN-14) pode deixar o teto negativo mesmo que a definição direta (acima) só aceite valor ≥ 0. */
            tetoCentavos: number;
        };
        DefinirRendaPrevista: {
            /** @description Referência de planejamento da competência (D-06). Não é teto de nada (RN-12). */
            rendaPrevistaCentavos: number;
        };
        CategoriaNaCompetencia: {
            id: string;
            nome: string;
            icone: string;
            cor: string;
            /** @description RN-40: 0 quando a categoria não tem OrcamentoMes nesta competência. */
            tetoCentavos: number;
            /** @description RN-10: soma dos lançamentos DESPESA da categoria nesta competência. Os lançamentos são da EF-04 (ainda não construída) — hoje esta soma é sempre 0 (ver servico.ts). */
            gastoCentavos: number;
            /** @description RN-10: teto − gasto. Negativo significa que a categoria estourou. */
            disponivelCentavos: number;
        };
        CompetenciaLida: {
            /** @description AAAA-MM. */
            competencia: string;
            rendaPrevistaCentavos: number;
            /** @description RN-11: Σ tetos das categorias. */
            planejadoCentavos: number;
            /** @description RN-39 (EF-04 §2): soma dos lançamentos RECEITA desta competência. Os lançamentos são da EF-04 (ainda não construída) — hoje esta soma é sempre 0 (ver servico.ts). */
            recebidoCentavos: number;
            /** @description RN-11: recebido − planejado. */
            naoAlocadoCentavos: number;
            categorias: {
                id: string;
                nome: string;
                icone: string;
                cor: string;
                /** @description RN-40: 0 quando a categoria não tem OrcamentoMes nesta competência. */
                tetoCentavos: number;
                /** @description RN-10: soma dos lançamentos DESPESA da categoria nesta competência. Os lançamentos são da EF-04 (ainda não construída) — hoje esta soma é sempre 0 (ver servico.ts). */
                gastoCentavos: number;
                /** @description RN-10: teto − gasto. Negativo significa que a categoria estourou. */
                disponivelCentavos: number;
            }[];
        };
        NovoRemanejamento: {
            /** @description De onde o teto sai. */
            categoriaOrigemId: string;
            /** @description Para onde o teto vai. */
            categoriaDestinoId: string;
            valorCentavos: number;
        };
        Remanejamento: {
            id: string;
            /** @description AAAA-MM — RN-13: só a competência corrente muda. */
            competencia: string;
            categoriaOrigemId: string;
            categoriaDestinoId: string;
            valorCentavos: number;
            /** @description RN-13: quem fez o remanejamento. */
            autorMembroId: string;
            /** @description ISO 8601. */
            criadoEm: string;
        };
        NovoLancamento: {
            /** @enum {string} */
            tipo: "RECEITA";
            /** @description O que foi lançado, em texto livre. */
            descricao: string;
            /** @description Inteiro em centavos (D-06). Em DESPESA parcelada, é o TOTAL da compra — o motor de parcelamento divide (RN-20/RN-21). */
            valorCentavos: number;
            /**
             * Format: date
             * @description AAAA-MM-DD — quando aconteceu (distinta da competência, RN-15).
             */
            data: string;
            /** @description A conta afetada (origem, em TRANSFERENCIA). */
            contaId: string;
        } | {
            /** @enum {string} */
            tipo: "DESPESA";
            /** @description O que foi lançado, em texto livre. */
            descricao: string;
            /** @description Inteiro em centavos (D-06). Em DESPESA parcelada, é o TOTAL da compra — o motor de parcelamento divide (RN-20/RN-21). */
            valorCentavos: number;
            /**
             * Format: date
             * @description AAAA-MM-DD — quando aconteceu (distinta da competência, RN-15).
             */
            data: string;
            /** @description A conta afetada (origem, em TRANSFERENCIA). */
            contaId: string;
            /** @description Obrigatório em DESPESA (EF-04 §1). */
            categoriaId: string;
            /** @description RN-20 — até 48×. Ausente (ou 1, que esta forma nem aceita) é despesa avulsa, sem SerieParcelas. */
            quantidadeParcelas?: number;
        } | {
            /** @enum {string} */
            tipo: "TRANSFERENCIA";
            /** @description O que foi lançado, em texto livre. */
            descricao: string;
            /** @description Inteiro em centavos (D-06). Em DESPESA parcelada, é o TOTAL da compra — o motor de parcelamento divide (RN-20/RN-21). */
            valorCentavos: number;
            /**
             * Format: date
             * @description AAAA-MM-DD — quando aconteceu (distinta da competência, RN-15).
             */
            data: string;
            /** @description A conta afetada (origem, em TRANSFERENCIA). */
            contaId: string;
            /** @description Para onde o dinheiro vai. Não pode ser igual a contaId (fork 3/#52 — 400, validação de entrada). */
            contaDestinoId: string;
        };
        Lancamento: {
            id: string;
            /** @enum {string} */
            tipo: "RECEITA" | "DESPESA" | "TRANSFERENCIA";
            descricao: string;
            valorCentavos: number;
            /** @description AAAA-MM-DD. */
            data: string;
            /** @description AAAA-MM — calculada na escrita (RN-15). */
            competencia: string;
            categoriaId: string | null;
            contaId: string;
            contaDestinoId: string | null;
            /** @description RN-16 — imutável. */
            criadoPorMembroId: string;
            /** @description RN-20/RN-21 — nulo fora de parcelamento. */
            serieParcelaId: string | null;
            /** @description 1-baseado; nulo fora de parcelamento. */
            numeroParcela: number | null;
            /** @description ISO 8601. */
            criadoEm: string;
        };
        LancamentosListados: {
            lancamentos: {
                id: string;
                /** @enum {string} */
                tipo: "RECEITA" | "DESPESA" | "TRANSFERENCIA";
                descricao: string;
                valorCentavos: number;
                /** @description AAAA-MM-DD. */
                data: string;
                /** @description AAAA-MM — calculada na escrita (RN-15). */
                competencia: string;
                categoriaId: string | null;
                contaId: string;
                contaDestinoId: string | null;
                /** @description RN-16 — imutável. */
                criadoPorMembroId: string;
                /** @description RN-20/RN-21 — nulo fora de parcelamento. */
                serieParcelaId: string | null;
                /** @description 1-baseado; nulo fora de parcelamento. */
                numeroParcela: number | null;
                /** @description ISO 8601. */
                criadoEm: string;
            }[];
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
            /** @description Email ainda não confirmado (RN-06) */
            403: {
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
            /** @description Código inválido, email não verificado ou sem conta */
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
    post_convites_aceitar: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
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
            /** @description Código do convite incorreto (RN-10), código do Google inválido ou email não verificado */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Nenhum convite pendente para este email */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Convite já usado, recusado, ou email de outra família */
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
            /** @description Código invalidado por excesso de tentativas (RN-11) */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
        };
    };
    post_cadastros: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CriarConta"];
            };
        };
        responses: {
            /** @description Família criada; confirmação enviada */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContaCriada"];
                };
            };
            /** @description Email já cadastrado (RN-07) ou com convite pendente (RN-08) */
            409: {
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
    post_cadastros_confirmar: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConfirmarConta"];
            };
        };
        responses: {
            /** @description Email confirmado; sessão aberta */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessaoAtual"];
                };
            };
            /** @description Código incorreto (RN-10) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Nenhuma confirmação pendente para este email */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Código expirado (RN-09) */
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
            /** @description Código invalidado por excesso de tentativas (RN-11) */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
        };
    };
    post_convites_recusar: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecusarConvite"];
            };
        };
        responses: {
            /** @description Convite recusado */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Código incorreto (RN-10) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Nenhum convite pendente para este email */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Convite já usado ou já recusado */
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
            /** @description Código invalidado por excesso de tentativas (RN-11) */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
        };
    };
    post_recuperacoes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PedirRecuperacao"];
            };
        };
        responses: {
            /** @description Pedido aceito — resposta idêntica exista ou não a conta (RN-13) */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecuperacaoPedida"];
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
    post_recuperacoes_concluir: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConcluirRecuperacao"];
            };
        };
        responses: {
            /** @description Senha trocada; sessões antigas encerradas e nova sessão aberta */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessaoAtual"];
                };
            };
            /** @description Código incorreto (RN-12) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Nenhuma recuperação pendente para este email */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Código expirado */
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
            /** @description Código invalidado por excesso de tentativas (RN-11) */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
        };
    };
    get_contas: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description As contas da família */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContasListadas"];
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
    post_contas: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NovaConta"];
            };
        };
        responses: {
            /** @description Conta criada */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Conta"];
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
            /** @description Corpo inválido — inclusive RN-08 (fechamento/vencimento fora de 1–28) */
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
    delete_contas__id_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Conta excluída */
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
            /** @description Conta inexistente nesta família */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Conta tem lançamentos e não pode ser excluída (RN-06) */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
        };
    };
    patch_contas__id_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AtualizarConta"];
            };
        };
        responses: {
            /** @description Conta atualizada */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Conta"];
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
            /** @description Conta inexistente nesta família */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Corpo inválido — inclusive RN-08 (fechamento/vencimento fora de 1–28) */
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
    get_categorias: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description As categorias da família */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategoriasListadas"];
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
    post_categorias: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NovaCategoria"];
            };
        };
        responses: {
            /** @description Categoria criada */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Categoria"];
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
            /** @description Corpo inválido — informe nome, ícone e cor */
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
    delete_categorias__id_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Categoria apagada */
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
            /** @description Categoria inexistente nesta família */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
        };
    };
    patch_categorias__id_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AtualizarCategoria"];
            };
        };
        responses: {
            /** @description Categoria atualizada */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Categoria"];
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
            /** @description Categoria inexistente nesta família */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Corpo inválido — informe nome, ícone e cor */
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
    get_competencias__competencia_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                competencia: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A leitura da competência */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CompetenciaLida"];
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
            /** @description Competência fora do formato AAAA-MM */
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
    put_competencias__competencia__renda_prevista: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                competencia: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DefinirRendaPrevista"];
            };
        };
        responses: {
            /** @description Renda prevista definida */
            200: {
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
            /** @description Corpo ou competência inválidos */
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
    put_competencias__competencia__categorias__categoriaId__teto: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                competencia: string;
                categoriaId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DefinirTeto"];
            };
        };
        responses: {
            /** @description Teto definido */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrcamentoMesLido"];
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
            /** @description Categoria inexistente nesta família */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Corpo ou competência inválidos */
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
    post_competencias__competencia__remanejamentos: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                competencia: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NovoRemanejamento"];
            };
        };
        responses: {
            /** @description Remanejamento registrado */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Remanejamento"];
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
            /** @description Categoria de origem ou destino inexistente nesta família */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Corpo ou competência inválidos */
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
    get_lancamentos: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Os lançamentos da família */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LancamentosListados"];
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
            /** @description Competência fora do formato AAAA-MM */
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
    post_lancamentos: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NovoLancamento"];
            };
        };
        responses: {
            /** @description Lançamento(s) criado(s) */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LancamentosListados"];
                };
            };
            /** @description contaId igual a contaDestinoId (fork 3/#52) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
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
            /** @description Conta ou categoria inexistente nesta família */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description Competência selada (RN-22, EF-08) */
            409: {
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
    get_lancamentos__id_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description O lançamento */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Lancamento"];
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
            /** @description Lançamento inexistente nesta família */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
        };
    };
    delete_lancamentos__id_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Lançamento(s) apagado(s) */
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
            /** @description Lançamento inexistente nesta família */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Erro"];
                };
            };
            /** @description modo inválido */
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
