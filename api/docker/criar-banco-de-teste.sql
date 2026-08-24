-- Cria o banco que a suíte de integração usa.
--
-- Roda uma vez, na inicialização do volume do Postgres. A suíte recria o
-- SCHEMA a cada execução; o banco em si precisa existir antes.
--
-- Existe um banco separado de propósito: a suíte apaga tudo entre execuções, e
-- apagar o banco de desenvolvimento (ou o que o gate de navegação acabou de
-- semear) transforma um teste verde em uma tela vazia.
SELECT 'CREATE DATABASE orcamento_teste'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'orcamento_teste')\gexec
