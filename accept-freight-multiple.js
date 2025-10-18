export default async function handler(req, res) {
  const { freight_id, num_trucks } = req.body;

  if (!freight_id || !num_trucks) {
    return res.status(400).json({ error: 'Parâmetros inválidos: freight_id ou num_trucks ausente.' });
  }

  const { data: freight, error: fetchError } = await supabase
    .from('freights')
    .select('*')
    .eq('id', freight_id)
    .single();

  if (fetchError || !freight) {
    return res.status(404).json({ error: 'Frete não encontrado.' });
  }

  if (freight.status === 'ACCEPTED') {
    return res.status(409).json({ error: 'Frete já aceito.' });
  }

  const { error: updateError } = await supabase
    .from('freights')
    .update({ status: 'ACCEPTED' })
    .eq('id', freight_id);

  if (updateError) {
    return res.status(500).json({ error: 'Erro ao atualizar status do frete.' });
  }

  return res.status(200).json({ message: 'Frete aceito com sucesso.' });
}