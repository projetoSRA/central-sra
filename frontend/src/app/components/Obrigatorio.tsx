// Asterisco que marca um campo obrigatório. Use dentro do <label> de todo
// campo que o formulário exige (required ou validado no envio).
export default function Obrigatorio() {
  return (
    <span className="text-red-400" title="Campo obrigatório">
      {" "}
      <span aria-hidden="true">*</span>
      <span className="sr-only">(obrigatório)</span>
    </span>
  );
}
