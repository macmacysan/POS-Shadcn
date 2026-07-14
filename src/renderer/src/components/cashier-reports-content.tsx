import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const reportTabs = [
  'Expenses',
  'Income',
  'Payment',
  'Installment Payments',
  'Activity',
  'In-house Installment',
  'Finance Installment',
] as const

export function CashierReportsContent(): React.JSX.Element {
  return (
    <Card className="m-4 min-h-0 min-w-0 flex-1 overflow-hidden">
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={200} minSize={150} maxSize={250} className="min-w-0">
          <aside className="flex h-full flex-col bg-muted/20 p-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">Reports</h2>
              <p className="text-xs text-muted-foreground">Select a report date</p>
            </div>
            <div className="mt-6 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              No reports yet.
            </div>
          </aside>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={90} minSize={70} className="min-w-0">
          <section className="flex h-full min-w-0 flex-col gap-4 p-4 sm:p-6">
            <Tabs defaultValue={reportTabs[0]} className="min-h-0 flex-1">
              <TabsList aria-label="Cashier report sections">
                {reportTabs.map((tab) => (
                  <TabsTrigger key={tab} value={tab}>
                    {tab}
                  </TabsTrigger>
                ))}
              </TabsList>
              {reportTabs.map((tab) => (
                <TabsContent key={tab} value={tab} className="rounded-lg border bg-card p-6">
                  <h2 className="text-lg font-semibold">{tab}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    No {tab.toLowerCase()} entries for this report.
                  </p>
                </TabsContent>
              ))}
            </Tabs>
          </section>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={240} minSize={180} maxSize={360} className="min-w-0">
          <Card className="h-full rounded-none border-0 border-l shadow-none">
            <CardHeader>
              <CardTitle>Report details</CardTitle>
              <CardDescription>Summary for the selected report</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Select a report to view its details.
              </div>
            </CardContent>
          </Card>
        </ResizablePanel>
      </ResizablePanelGroup>
    </Card>
  )
}
