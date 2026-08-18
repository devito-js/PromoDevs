"use client";

import { useRef } from "react";

interface FiltroLojaProps {
  lojas: { loja: string; total: number }[];
  lojaSelecionada?: string;
}

/**
 * Único pedaço de client-side dessa tela. Usa um <form> com GET de verdade
 * (sem fetch, sem estado de cliente) — trocar a loja só navega pra
 * "/?loja=X", e quem busca e filtra os dados continua sendo o Server
 * Component em page.tsx. O `requestSubmit()` no onChange é só pra não
 * precisar de um botão "Filtrar" separado.
 */
export function FiltroLoja({ lojas, lojaSelecionada }: FiltroLojaProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} method="get" className="filtro-loja">
      <label htmlFor="loja-select">Loja</label>
      <select
        id="loja-select"
        name="loja"
        defaultValue={lojaSelecionada ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
      >
        <option value="">Todas as lojas</option>
        {lojas.map(({ loja, total }) => (
          <option key={loja} value={loja}>
            {loja} ({total})
          </option>
        ))}
      </select>
    </form>
  );
}
