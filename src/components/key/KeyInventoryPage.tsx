import { useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { RiskTileBar, type RiskTileDef } from "@/components/common/RiskTileBar";
import { ColumnPicker, type ColumnDef } from "@/components/common/ColumnPicker";
import { FilterChips } from "@/components/common/FilterChips";
import { ProvisionDialog } from "@/components/key/ProvisionDialog";
import { RotateKeyDialog } from "@/components/key/RotateKeyDialog";
import { DeleteKeyWithCertDialog } from "@/components/key/DeleteKeyWithCertDialog";
import { CertificatesOfKeyModal } from "@/components/key/CertificatesOfKeyModal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CertDetailDrawer } from "@/components/cert/CertDetailDrawer";
import { usePersistedState } from "@/hooks/use-persisted-state";
import type { SshKey, SshCert, RiskStatus } from "@/data/mock";
import { riskColor, GROUPS } from "@/data/mock";
import { ChevronDown, ChevronRight, Columns, Link2, Plus, RefreshCw, Search, Shield, ClipboardList, SlidersHorizontal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  rotateKeyAction, coupledRotateAction, provisionCertAction,
  certRevokeAction, COMBO_LABEL, COMBO_BADGE_CLASS,
} from "@/lib/clm-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface KeyInventoryProps {
  scope: "user" | "host";
  breadcrumbs: string[];
  title: string;
  riskKinds: RiskStatus[];
  initialKeys: SshKey[];
  total: number;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Key Name", mandatory: true },
  { key: "associatedUsers", label: "Associated Users" },
  { key: "clientEndpoints", label: "Client Endpoint(s)" },
  { key: "hostEndpoints", label: "Host Endpoint(s)" },
  { key: "age", label: "Age" },
  { key: "encryption", label: "Encryption" },
  { key: "length", label: "Length" },
  { key: "fingerprint", label: "Fingerprint" },
  { key: "comment", label: "Comment" },
  { key: "keyComplianceGroup", label: "Key Compliance Group" },
  { key: "status", label: "Status" },
  { key: "filePaths", label: "FilePaths" },
  { key: "riskStatus", label: "Risk Status" },
  { key: "complianceStatus", label: "Compliance Status" },
];

const DEFAULT_USER_COLS = ["name", "associatedUsers", "clientEndpoints", "hostEndpoints", "age"];
const DEFAULT_HOST_COLS = ["name", "clientEndpoints", "hostEndpoints", "age", "encryption", "length"];

const PAGE = 25;

export function KeyInventoryPage(props: KeyInventoryProps) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { highlight?: string };

  const [keys, setKeys] = useState(props.initialKeys);
  const [group, setGroup] = useState("All Keys");
  const [search_, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [expanded, setExpanded] = useState>({});
  const [cols, setCols] = usePersistedState(
    `kcols-${props.scope}`,
    props.scope === "user" ? DEFAULT_USER_COLS : DEFAULT_HOST_COLS,
  );
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [certsForKey, setCertsForKey] = useState(null);
  const [provisionFor, setProvisionFor] = useState(null);
  const [rotateFor, setRotateFor] = useState(null);
  const [deleteWithCertFor, setDeleteWithCertFor] = useState(null);
  const [confirmDeleteOnly, setConfirmDeleteOnly] = useState(null);
  const [confirmRevoke, setConfirmRevoke] = useState(null);
  const [statusChangeFor, setStatusChangeFor] = useState(null);
  const [statusNew, setStatusNew] = useState<"Active" | "Inactive">("Active");
  const [drawerCert, setDrawerCert] = useState(null);

  const filtered = useMemo(() => {
    let list = keys;
    if (group !== "All Keys") list = list.filter((k) => k.keyComplianceGroup === group);
    if (riskFilter) list = list.filter((k) => k.riskStatus === riskFilter);
    if (search_) {
      const s = search_.toLowerCase();
      list = list.filter(
        (k) =>
          k.name.toLowerCase().includes(s) ||
          k.fingerprint.toLowerCase().includes(s) ||
          k.associatedUsers.some((u) => u.toLowerCase().includes(s)),
      );
    }
    return list;
  }, [keys, group, riskFilter, search_]);

  const paged = filtered.slice((page - 1) * PAGE, page * PAGE);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const selectedKeys = paged.filter((k) => selectedIds.includes(k.id));

  const tiles: RiskTileDef[] = useMemo(() => {
    const counts: Record = {};
    props.riskKinds.forEach((r) => {
      counts[r] = keys.filter((k) => k.riskStatus === r).length;
    });
    return props.riskKinds.map((r) => ({
      key: r,
      label: `${r} Keys`,
      count: counts[r] ?? 0,
      total: keys.length,
      color: ["Rogue", "Suspicious", "Misplaced"].includes(r) ? "red" : "amber",
      info: `Keys flagged as ${r}`,
    }));
  }, [keys, props.riskKinds]);

  const visibleCols = ALL_COLUMNS.filter((c) => cols.includes(c.key) || c.mandatory);

  const toggleSelectAll = () => {
    if (selectedIds.length === paged.length && paged.length > 0) setSelectedIds([]);
    else setSelectedIds(paged.map((k) => k.id));
  };

  const updateKey = (id: string, patch: Partial) =>
    setKeys((ks) => ks.map((k) => (k.id === id ? { ...k, ...patch } : k)));

  const removeKey = (id: string) => {
    setKeys((ks) => ks.filter((k) => k.id !== id));
    setSelectedIds((s) => s.filter((x) => x !== id));
  };

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  };

  const chips = [
    riskFilter ? { key: "risk", label: `Risk: ${riskFilter}` } : null,
    search.highlight ? { key: "highlight", label: `Highlight: ${search.highlight}` } : null,
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    


      

       {
          setRiskFilter((curr) => (curr === k ? null : (k as RiskStatus)));
          setPage(1);
        }}
      />

       {
          if (k === "risk") setRiskFilter(null);
          if (k === "highlight") navigate({ to: ".", search: {} as never });
        }}
      />

      


        Groups
         { setGroup(v); setPage(1); }}>
          
            
          
          
            All Keys
            {GROUPS.filter((g) => g !== "All Groups").map((g) => (
              {g}
            ))}
          
        

        


          
           { setSearch(e.target.value); setPage(1); }}
          />
           toast.info("Advanced search panel — coming soon.")}
          >
            
          
        



        


           toast.info("Add Key — Coming Soon")}>
            
          

          
            
               0 ? "default" : "outline"}
                disabled={selectedKeys.length === 0}
              >
                Actions 
              
            
            

              {/* Combination label */}
              {selectedKeys[0] && (
                


                  Combination
                  


                    {COMBO_LABEL[selectedKeys[0].combination]}
                  


                


              )}

              {/* Always available */}
               toast.success("Key updated.")}>Modify
               { setStatusChangeFor(selectedKeys[0]); setStatusNew(selectedKeys[0].status === "Active" ? "Inactive" : "Active"); }}>
                Change Status
              
               toast.success(`Exported ${selectedKeys.length} key(s) to CSV.`)}>Export
               toast.success("Key file download started.")}>Download

              {/* Provision Certificate — combo-aware */}
              {(() => {
                const a = selectedKeys[0] ? provisionCertAction(selectedKeys[0].combination) : { show: false, enabled: false };
                if (!a.show) return null;
                if (!a.enabled)
                  return (
                    
                      
                        Provision Certificate
                      
                      {a.tooltip}
                    
                  );
                return  setProvisionFor(selectedKeys[0])}>Provision Certificate;
              })()}

              {/* Rotate Key — combo-aware */}
              {(() => {
                const a = selectedKeys[0] ? rotateKeyAction(selectedKeys[0].combination) : { show: false, enabled: false };
                if (!a.show) return null;
                if (!a.enabled)
                  return (
                    
                      
                        Rotate Key
                      
                      {a.tooltip}
                    
                  );
                return  setRotateFor(selectedKeys[0])}>Rotate Key;
              })()}

              {/* Coupled Rotate — private_cert only */}
              {(() => {
                const a = selectedKeys[0] ? coupledRotateAction(selectedKeys[0].combination) : { show: false, enabled: false };
                if (!a.show) return null;
                return (
                   setRotateFor(selectedKeys[0])}>
                    Coupled Rotate (Key + Cert)
                  
                );
              })()}

              {/* Revoke Cert — only when cert exists on relevant combo */}
              {(() => {
                const combo = selectedKeys[0]?.combination;
                const hasCert = selectedKeys[0]?.hasCert;
                if (!hasCert || (combo !== "private_cert" && combo !== "public_cert")) return null;
                const a = selectedKeys[0] ? certRevokeAction(selectedKeys[0].status === "Revoked" ? "Revoked" : "Active") : { show: false, enabled: false };
                if (!a.enabled)
                  return (
                    
                      
                        Revoke Certificate
                      
                      {a.tooltip}
                    
                  );
                return (
                   setConfirmRevoke(selectedKeys[0])}>
                    Revoke Certificate
                  
                );
              })()}

              Rollback

              
                Delete
                
                  
                     setConfirmDeleteOnly(selectedKeys[0])}>Delete Key Only
                     setDeleteWithCertFor(selectedKeys[0])}
                    >
                      Delete Key + Certificate
                    
                  
                
              

               toast.success("Tags uploaded successfully.")}>Upload Bulk Tags
               toast.success("Key group updated.")}>Change Key Group
            
          

           setColPickerOpen(true)} title="Columns">
            
          

          
            
          
        


      



      


        


          
                {visibleCols.map((c, i) => {
                  const sticky = i === 0;
                  return (
                    
                  );
                })}
              
              {paged.map((k) => {
                const isExpanded = !!expanded[k.id];
                const isSelected = selectedIds.includes(k.id);
                const isHighlighted = search.highlight === k.id;
                return (
                  
                    
                      {visibleCols.map((c, i) => {
                        const sticky = i === 0;
                        return (
                          
                        );
                      })}
                    
                    {isExpanded && (
                      
                    )}
                  
                );
              })}
              {paged.length === 0 && (
                
              )}
            


            
              
                
                
                   0 && selectedIds.length === paged.length}
                    onCheckedChange={toggleSelectAll}
                  />
                
                      {c.label}
                      {c.mandatory && *}
                    
            
            
                      
                         setExpanded((e) => ({ ...e, [k.id]: !e[k.id] }))}
                        >
                          {isExpanded ?  : }
                        
                      
                      
                        
                            setSelectedIds((s) => (v ? [...s, k.id] : s.filter((x) => x !== k.id)))
                          }
                        />
                      
                            {renderCell(k, c.key, { onCertClick: () => setCertsForKey(k) })}
                          
                        
                          


                            {k.fingerprint}} />
                            
                            
                          


                        
                      
                  
                    No keys match the current filters.
                  
                
          


        


        


          
            {filtered.length === 0 ? 0 : (page - 1) * PAGE + 1} to {Math.min(page * PAGE, filtered.length)} of {filtered.length}
          
           setPage((p) => Math.max(1, p - 1))}>‹
          = pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>›
        


      



       setColPickerOpen(false)} columns={ALL_COLUMNS} selected={cols} onSave={setCols} />

       setCertsForKey(null)}
        onSelectCert={(c) => { setCertsForKey(null); setDrawerCert(c); }}
      />

       setDrawerCert(null)} />

       setProvisionFor(null)} onProvisioned={(id) => updateKey(id, { hasCert: true, certCount: 1 })} />
       setRotateFor(null)} onDone={(id) => updateKey(id, { age: "0 days" })} />
       setDeleteWithCertFor(null)} onDone={(id) => removeKey(id)} />

       setConfirmDeleteOnly(null)}
        onConfirm={() => { if (confirmDeleteOnly) { removeKey(confirmDeleteOnly.id); toast.success(`Key "${confirmDeleteOnly.name}" deleted.`); } setConfirmDeleteOnly(null); }}
      />

       setConfirmRevoke(null)}
        onConfirm={() => { if (confirmRevoke) { updateKey(confirmRevoke.id, { status: "Revoked" }); toast.success(`Key "${confirmRevoke.name}" revoked.`); } setConfirmRevoke(null); }}
      />

      
             setStatusNew("Active")} /> Active
             setStatusNew("Inactive")} /> Inactive
          


        }
        confirmLabel="Save"
        onClose={() => setStatusChangeFor(null)}
        onConfirm={() => { if (statusChangeFor) { updateKey(statusChangeFor.id, { status: statusNew }); toast.success("Status updated."); } setStatusChangeFor(null); }}
      />
    
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children};
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    


      

{label}


      

{value}


    


  );
}

function renderCell(k: SshKey, col: string, opts: { onCertClick: () => void }): React.ReactNode {
  switch (col) {
    case "name":
      return (
        


          {k.name}
          {k.hasCert && (
            
              
            
          )}
          
          
          
            {COMBO_LABEL[k.combination]}
          
        


      );
    case "associatedUsers": return ;
    case "clientEndpoints": return ;
    case "hostEndpoints":   return ;
    case "age":             return {k.age || "—"};
    case "encryption":      return {k.encryption};
    case "length":          return {k.length};
    case "fingerprint":     return {k.fingerprint.slice(0, 18)}…;
    case "comment":         return {k.comment || "—"};
    case "keyComplianceGroup": return {k.keyComplianceGroup};
    case "status":
      return (
        
          {k.status}
        
      );
    case "filePaths":       return {k.filePaths.join(", ") || "—"};
    case "riskStatus":      return {k.riskStatus};
    case "complianceStatus":
      return (
        
          {k.complianceStatus}
        
      );
    default: return null;
  }
}

function Truncated({ items, mono }: { items: string[]; mono?: boolean }) {
  if (items.length === 0) return —;
  return (
    


      {items[0]}
      {items.length > 1 && +{items.length - 1}}
    


  );
}

export { Link };
