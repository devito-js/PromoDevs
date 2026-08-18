import { getDomain } from "tldts";

/**
 * Extrai o domínio *registrável* (eTLD+1) de uma URL — ex:
 * "clube.magazineluiza.com.br" -> "magazineluiza.com.br",
 * "s.click.aliexpress.com" -> "aliexpress.com".
 *
 * Por que não só tirar o "www." (como fazíamos antes): fontes diferentes
 * às vezes expõem subdomínios específicos da loja em vez do site principal
 * (ex: um subdomínio de programa de fidelidade, ou de link de afiliado
 * regionalizado). Se guardássemos esse subdomínio como está, a extensão de
 * navegador (que casa pelo hostname da aba atual) nunca bateria pra quem
 * está no domínio "normal" da loja. Usar o domínio registrável resolve
 * isso: qualquer subdomínio da mesma loja aponta pro mesmo valor.
 *
 * `tldts` usa a Public Suffix List de verdade por baixo — sem isso, um
 * corte ingênuo (ex: "pegar as 2 últimas partes") erraria em TLDs
 * compostos como ".com.br" (viraria só "com.br").
 */
export function extrairDominioRegistravel(url: string): string | null {
  try {
    return getDomain(url);
  } catch {
    return null;
  }
}
