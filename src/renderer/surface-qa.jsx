import React from 'react'
import {createRoot} from 'react-dom/client'
import {useReactTable,getCoreRowModel,getPaginationRowModel} from '@tanstack/react-table'
import {UniversalDataTable} from './src/components/shared/data-table/universal-data-table'
import {TableToolbar} from './src/components/shared/data-table/table-toolbar'
import {Badge} from './src/components/ui/badge'
import {Button} from './src/components/ui/button'
import {SidebarProvider,Sidebar,SidebarInset} from './src/components/ui/sidebar'
import {WorkstationSurface} from './src/components/shared/workstation/workstation-layout'
import './src/assets/main.css'
const data=[{amount:'₱1,234.56'},{amount:'₱0.00'}],columns=[{accessorKey:'amount',header:'Amount',meta:{cellClassName:'text-right tabular-nums'}}]
function Test(){const table=useReactTable({data,columns,getCoreRowModel:getCoreRowModel(),getPaginationRowModel:getPaginationRowModel()});return <SidebarProvider><Sidebar><span id="navigation">Fixture branch</span></Sidebar><SidebarInset><header id="title" className="border-b bg-workspace-subtle">Report</header><WorkstationSurface title="Transactions"><TableToolbar><Button id="focus" variant="outline">Filter</Button>{['emerald','amber','blue','destructive'].map(v=><Badge key={v} variant={v}>{v}</Badge>)}</TableToolbar><UniversalDataTable table={table} recordCount={2} selectedRowId="1"/></WorkstationSurface></SidebarInset></SidebarProvider>}
createRoot(document.getElementById('root')).render(<Test/>)
