/** Exercise the visible dropdown rather than its hidden form control. */
export async function chooseOption(control, value) {
  const label = typeof value === 'object' ? value.label : await control.locator('..').locator('select').evaluate((select, selectedValue) => Array.from(select.options).find(option => option.value === selectedValue)?.label, value);
  if (!label) throw new Error(`Dropdown option not found: ${JSON.stringify(value)}`);
  await control.click();
  await control.page().getByRole('option', { name: label, exact: true }).click();
}
