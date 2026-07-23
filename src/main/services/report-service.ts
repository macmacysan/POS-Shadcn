import { ReportRepository } from '../database/report-repository'

export class ReportService {
  constructor(private readonly repository: ReportRepository) {}

  getById(reportId: string) {
    return this.repository.findById(reportId)
  }
}
