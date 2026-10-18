import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export async function downloadJournalPdf(element: HTMLElement, filename: string) {
  await document.fonts.ready
  const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
  const image = canvas.toDataURL('image/png')
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = 210
  const pageHeight = 297
  const imageHeight = (canvas.height * pageWidth) / canvas.width
  let position = 0

  pdf.addImage(image, 'PNG', 0, position, pageWidth, imageHeight)
  while (position + imageHeight > pageHeight) {
    position -= pageHeight
    pdf.addPage()
    pdf.addImage(image, 'PNG', 0, position, pageWidth, imageHeight)
  }
  pdf.save(`${filename}.pdf`)
}
