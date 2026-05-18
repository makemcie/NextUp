"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
	getSuperAdminData, adminGetShopDetail, adminUpdateClientEmail,
	adminDeleteClient, adminDeleteShop, adminUpdateShopStatus,
	adminUpdateUserEmail, adminIssueRefund, adminCancelSubscription, adminResetUserPassword,
} from "@/lib/server-fns";

export const Route = createFileRoute("/admin")({
	component: AdminPage,
});

const sc = (status: string) => ({
	active:   { bg:"rgba(16,185,129,0.1)",  border:"rgba(16,185,129,0.25)",  color:"#10b981" },
	trial:    { bg:"rgba(249,115,22,0.1)",  border:"rgba(249,115,22,0.25)",  color:"#f97316" },
	past_due: { bg:"rgba(239,68,68,0.1)",   border:"rgba(239,68,68,0.25)",   color:"#ef4444" },
	canceled: { bg:"rgba(71,85,105,0.1)",   border:"rgba(71,85,105,0.25)",   color:"#475569" },
}[status] ?? { bg:"rgba(71,85,105,0.1)", border:"rgba(71,85,105,0.25)", color:"#475569" });

function Badge({ status }: { status: string }) {
	const c = sc(status);
	return (
		<span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:20, background:c.bg, border:`1px solid ${c.border}`, fontSize:11, fontWeight:700, color:c.color }}>
			<div style={{ width:4,height:4,borderRadius:"50%",background:c.color }} />
			{status.toUpperCase()}
		</span>
	);
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
	return (
		<div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }} onClick={onClose}>
			<div style={{ background:"#0d0d12", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:28, width:"100%", maxWidth:680, maxHeight:"85vh", overflowY:"auto" }} onClick={e => e.stopPropagation()}>
				<div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
					<h2 style={{ fontSize:17, fontWeight:800, color:"white" }}>{title}</h2>
					<button type="button" onClick={onClose} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:"50%", width:30, height:30, cursor:"pointer", color:"white", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
				</div>
				{children}
			</div>
		</div>
	);
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
	return (
		<div style={{ marginBottom:14 }}>
			<label style={{ display:"block", fontSize:12, color:"#94a3b8", marginBottom:6, fontWeight:600 }}>{label}</label>
			<input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
				style={{ width:"100%", padding:"11px 14px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, color:"white", fontSize:13, outline:"none", fontFamily:"inherit" }} />
		</div>
	);
}

function Btn({ onClick, children, color = "#f97316", disabled = false }: { onClick: () => void; children: React.ReactNode; color?: string; disabled?: boolean }) {
	return (
		<button type="button" onClick={onClick} disabled={disabled}
			style={{ padding:"9px 18px", background:color === "red" ? "rgba(239,68,68,0.15)" : color === "green" ? "rgba(16,185,129,0.15)" : color === "gray" ? "rgba(71,85,105,0.2)" : "rgba(249,115,22,0.15)", border:`1px solid ${color === "red" ? "rgba(239,68,68,0.3)" : color === "green" ? "rgba(16,185,129,0.3)" : color === "gray" ? "rgba(71,85,105,0.3)" : "rgba(249,115,22,0.3)"}`, borderRadius:10, color:color === "red" ? "#ef4444" : color === "green" ? "#10b981" : color === "gray" ? "#64748b" : "#f97316", fontSize:13, fontWeight:600, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.5:1, fontFamily:"inherit" }}>
			{children}
		</button>
	);
}

function ShopDetailModal({ shopId, onClose }: { shopId: number; onClose: () => void }) {
	const qc = useQueryClient();
	const { data, isLoading } = useQuery({
		queryKey: ["adminShopDetail", shopId],
		queryFn: () => adminGetShopDetail({ data: { shopId } }),
	});
	const [tab, setTab] = useState<"clients"|"barbers"|"visits"|"actions">("clients");
	const [editClientId, setEditClientId] = useState<number|null>(null);
	const [editEmail, setEditEmail] = useState("");
	const [editUserEmail, setEditUserEmail] = useState("");
	const [refundReason, setRefundReason] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [msg, setMsg] = useState("");

	const updateEmail = useMutation({
		mutationFn: (args: { clientId: number; email: string }) => adminUpdateClientEmail({ data: args }),
		onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminShopDetail", shopId] }); setEditClientId(null); setMsg("Email updated ✓"); },
	});
	const deleteClient = useMutation({
		mutationFn: (clientId: number) => adminDeleteClient({ data: { clientId } }),
		onSuccess: () => { qc.invalidateQueries({ queryKey: ["adminShopDetail", shopId] }); setMsg("Client deleted ✓"); },
	});
	const updateStatus = useMutation({
		mutationFn: (status: string) => adminUpdateShopStatus({ data: { shopId, status } }),
		onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin"] }); setMsg("Status updated ✓"); },
	});
	const updateUserEmail = useMutation({
		mutationFn: () => adminUpdateUserEmail({ data: { targetUserId: data?.shop?.users?.id ?? 0, email: editUserEmail } }),
		onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin"] }); setMsg("Owner email updated ✓"); },
	});
	const issueRefund = useMutation({
		mutationFn: () => adminIssueRefund({ data: { stripeSubscriptionId: data?.shop?.shops?.stripeSubscriptionId ?? "", reason: refundReason } }),
		onSuccess: (r) => setMsg(`Refund issued ✓ ID: ${r.refundId}`),
		onError: (e: any) => setMsg(`Error: ${e.message}`),
	});
	const resetPassword = useMutation({
		mutationFn: () => adminResetUserPassword({ data: { targetUserId: owner?.id ?? 0, newPassword } }),
		onSuccess: () => { setMsg("Password reset ✓ — user sessions invalidated"); setNewPassword(""); },
		onError: (e: any) => setMsg(`Error: ${e.message}`),
	});

	const cancelSub = useMutation({
		mutationFn: () => adminCancelSubscription({ data: { stripeSubscriptionId: data?.shop?.shops?.stripeSubscriptionId ?? "", shopId } }),
		onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin"] }); setMsg("Subscription canceled ✓"); },
		onError: (e: any) => setMsg(`Error: ${e.message}`),
	});

	const shop = data?.shop?.shops;
	const owner = data?.shop?.users;

	return (
		<Modal title={shop?.name ?? "Shop Detail"} onClose={onClose}>
			{isLoading ? <p style={{ color:"#64748b", fontSize:13 }}>Loading...</p> : (
				<>
					{msg && <div style={{ padding:"10px 14px", background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.25)", borderRadius:10, color:"#10b981", fontSize:13, marginBottom:16 }}>{msg}</div>}

					{/* Shop info */}
					<div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
						<Badge status={shop?.subscriptionStatus ?? "trial"} />
						<span style={{ fontSize:12, color:"#64748b" }}>Owner: {owner?.email}</span>
						{shop?.stripeSubscriptionId && <span style={{ fontSize:11, color:"#334155", fontFamily:"monospace" }}>{shop.stripeSubscriptionId}</span>}
					</div>

					{/* Tabs */}
					<div style={{ display:"flex", gap:6, marginBottom:20, borderBottom:"1px solid rgba(255,255,255,0.06)", paddingBottom:12 }}>
						{(["clients","barbers","visits","actions"] as const).map(t => (
							<button key={t} type="button" onClick={() => setTab(t)}
								style={{ padding:"6px 14px", borderRadius:8, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit",
									background:tab===t?"rgba(249,115,22,0.15)":"transparent",
									color:tab===t?"#f97316":"#475569" }}>
								{t.charAt(0).toUpperCase()+t.slice(1)} {t==="clients"?`(${data?.clients?.length??0})`:t==="barbers"?`(${data?.barbers?.length??0})`:t==="visits"?`(${data?.visits?.length??0})`:""}</button>
						))}
					</div>

					{/* CLIENTS */}
					{tab === "clients" && (
						<div style={{ display:"flex", flexDirection:"column", gap:8 }}>
							{data?.clients?.length === 0 && <p style={{ color:"#334155", fontSize:13 }}>No clients yet.</p>}
							{data?.clients?.map(c => (
								<div key={c.id} style={{ padding:"12px 14px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12 }}>
									<div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, flexWrap:"wrap" }}>
										<div>
											<p style={{ fontSize:13, fontWeight:600, color:"white", marginBottom:2 }}>{c.name}</p>
											<p style={{ fontSize:11, color:"#64748b" }}>{c.phone} · {c.email ?? "no email"} · {c.visitCount ?? 0} visits</p>
										</div>
										<div style={{ display:"flex", gap:6 }}>
											<Btn color="gray" onClick={() => { setEditClientId(c.id); setEditEmail(c.email ?? ""); }}>Edit Email</Btn>
											<Btn color="red" onClick={() => { if(confirm(`Delete ${c.name}?`)) deleteClient.mutate(c.id); }}>Delete</Btn>
										</div>
									</div>
									{editClientId === c.id && (
										<div style={{ marginTop:12 }}>
											<Input label="New Email" value={editEmail} onChange={setEditEmail} placeholder="new@email.com" />
											<div style={{ display:"flex", gap:8 }}>
												<Btn color="green" onClick={() => updateEmail.mutate({ clientId: c.id, email: editEmail })} disabled={updateEmail.isPending}>Save</Btn>
												<Btn color="gray" onClick={() => setEditClientId(null)}>Cancel</Btn>
											</div>
										</div>
									)}
								</div>
							))}
						</div>
					)}

					{/* BARBERS */}
					{tab === "barbers" && (
						<div style={{ display:"flex", flexDirection:"column", gap:8 }}>
							{data?.barbers?.length === 0 && <p style={{ color:"#334155", fontSize:13 }}>No staff yet.</p>}
							{data?.barbers?.map(b => (
								<div key={b.id} style={{ padding:"12px 14px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12 }}>
									<p style={{ fontSize:13, fontWeight:600, color:"white", marginBottom:2 }}>{b.name}</p>
									<p style={{ fontSize:11, color:"#64748b" }}>{b.specialty ?? "No specialty"} · {b.phone ?? "no phone"} · Code: {b.accessCode}</p>
									<p style={{ fontSize:11, color:b.isActive ? "#10b981" : "#475569", marginTop:2 }}>{b.isActive ? "Active" : "Inactive"} {b.onVacation ? "· On vacation" : ""}</p>
								</div>
							))}
						</div>
					)}

					{/* VISITS */}
					{tab === "visits" && (
						<div style={{ display:"flex", flexDirection:"column", gap:6 }}>
							{data?.visits?.length === 0 && <p style={{ color:"#334155", fontSize:13 }}>No visits yet.</p>}
							{data?.visits?.map(v => (
								<div key={v.id} style={{ padding:"10px 14px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
									<span style={{ fontSize:12, color:"#94a3b8" }}>Visit #{v.id} · Client #{v.clientId}</span>
									<Badge status={v.status ?? "waiting"} />
								</div>
							))}
						</div>
					)}

					{/* ACTIONS */}
					{tab === "actions" && (
						<div style={{ display:"flex", flexDirection:"column", gap:18 }}>

							{/* Change subscription status */}
							<div style={{ padding:16, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12 }}>
								<p style={{ fontSize:13, fontWeight:600, color:"white", marginBottom:12 }}>Change Subscription Status</p>
								<div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
									{["active","trial","past_due","canceled"].map(s => (
										<Btn key={s} color={s==="active"?"green":s==="canceled"?"red":"gray"} onClick={() => { if(confirm(`Set status to ${s}?`)) updateStatus.mutate(s); }}>
											{s.toUpperCase()}
										</Btn>
									))}
								</div>
							</div>

							{/* Edit owner email */}
							<div style={{ padding:16, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12 }}>
								<p style={{ fontSize:13, fontWeight:600, color:"white", marginBottom:12 }}>Edit Owner Account Email</p>
								<Input label="Current Email" value={owner?.email ?? ""} onChange={() => {}} />
								<Input label="New Email" value={editUserEmail} onChange={setEditUserEmail} placeholder="new@email.com" />
								<Btn color="green" onClick={() => updateUserEmail.mutate()} disabled={!editUserEmail || updateUserEmail.isPending}>Update Email</Btn>
							</div>

							{/* Reset Password */}
							<div style={{ padding:16, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12 }}>
								<p style={{ fontSize:13, fontWeight:600, color:"white", marginBottom:12 }}>Reset Owner Password</p>
								<Input label="New Password (min 6 chars)" value={newPassword} onChange={setNewPassword} placeholder="new password..." />
								<Btn color="red" onClick={() => { if(confirm("Reset this user password? All sessions will be invalidated.")) resetPassword.mutate(); }} disabled={newPassword.length < 6 || resetPassword.isPending}>
									{resetPassword.isPending ? "Resetting..." : "Reset Password"}
								</Btn>
							</div>

							{/* Refund */}
							<div style={{ padding:16, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12 }}>
								<p style={{ fontSize:13, fontWeight:600, color:"white", marginBottom:12 }}>Issue Refund (last payment)</p>
								{!shop?.stripeSubscriptionId && <p style={{ fontSize:12, color:"#475569", marginBottom:10 }}>No Stripe subscription linked.</p>}
								<Input label="Reason" value={refundReason} onChange={setRefundReason} placeholder="e.g. 7-day guarantee" />
								<Btn color="red" onClick={() => { if(confirm("Issue refund for last payment?")) issueRefund.mutate(); }} disabled={!shop?.stripeSubscriptionId || issueRefund.isPending}>
									{issueRefund.isPending ? "Processing..." : "Issue Refund"}
								</Btn>
							</div>

							{/* Cancel subscription */}
							<div style={{ padding:16, background:"rgba(239,68,68,0.04)", border:"1px solid rgba(239,68,68,0.15)", borderRadius:12 }}>
								<p style={{ fontSize:13, fontWeight:600, color:"#ef4444", marginBottom:6 }}>Cancel Subscription</p>
								{!shop?.stripeSubscriptionId && <p style={{ fontSize:12, color:"#475569", marginBottom:8 }}>No Stripe subscription linked.</p>}
								<p style={{ fontSize:12, color:"#64748b", marginBottom:12 }}>This will immediately cancel the Stripe subscription and mark the shop as canceled.</p>
								<Btn color="red" onClick={() => { if(confirm("Cancel subscription? This cannot be undone.")) cancelSub.mutate(); }} disabled={!shop?.stripeSubscriptionId || cancelSub.isPending}>
									{cancelSub.isPending ? "Canceling..." : "Cancel Subscription"}
								</Btn>
							</div>

							{/* Delete shop */}
							<div style={{ padding:16, background:"rgba(239,68,68,0.04)", border:"1px solid rgba(239,68,68,0.15)", borderRadius:12 }}>
								<p style={{ fontSize:13, fontWeight:600, color:"#ef4444", marginBottom:6 }}>Delete Shop (Irreversible)</p>
								<p style={{ fontSize:12, color:"#64748b", marginBottom:12 }}>Deletes the shop and all its data: clients, visits, barbers, appointments.</p>
								<Btn color="red" onClick={() => { if(confirm("DELETE this shop and ALL its data? This is irreversible.")) adminDeleteShop({ data: { shopId } }).then(() => { qc.invalidateQueries({ queryKey: ["superadmin"] }); onClose(); }); }}>
									Delete Shop Permanently
								</Btn>
							</div>
						</div>
					)}
				</>
			)}
		</Modal>
	);
}

function AdminPage() {
	const { data, isLoading, error } = useQuery({
		queryKey: ["superadmin"],
		queryFn: () => getSuperAdminData(),
		refetchInterval: 30000,
	});
	const [selectedShopId, setSelectedShopId] = useState<number|null>(null);
	const [search, setSearch] = useState("");

	if (isLoading) return (
		<div style={{ minHeight:"100vh", background:"#060608", display:"flex", alignItems:"center", justifyContent:"center" }}>
			<div style={{ textAlign:"center" }}>
				<div style={{ width:40,height:40,border:"2px solid #f97316",borderTopColor:"transparent",borderRadius:"50%",margin:"0 auto 12px",animation:"spin 0.8s linear infinite" }} />
				<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
				<p style={{ color:"#64748b",fontSize:13,fontFamily:"system-ui" }}>Loading...</p>
			</div>
		</div>
	);

	if (error) return (
		<div style={{ minHeight:"100vh", background:"#060608", display:"flex", alignItems:"center", justifyContent:"center" }}>
			<p style={{ color:"#ef4444", fontFamily:"system-ui", fontSize:14 }}>Access denied.</p>
		</div>
	);

	const s = data?.stats;
	const filtered = data?.shops.filter(sh =>
		sh.shopName?.toLowerCase().includes(search.toLowerCase()) ||
		sh.ownerEmail?.toLowerCase().includes(search.toLowerCase())
	) ?? [];

	return (
		<div style={{ minHeight:"100vh", background:"#060608", color:"white", fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
			<style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>

			{/* Header */}
			<div style={{ background:"rgba(255,255,255,0.02)", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
				<div style={{ display:"flex", alignItems:"center", gap:10 }}>
					<div style={{ width:32,height:32,background:"linear-gradient(135deg,#f97316,#c2410c)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center" }}>
						<span style={{ fontWeight:800,fontSize:16,color:"white" }}>G</span>
					</div>
					<div>
						<p style={{ fontSize:15, fontWeight:800, color:"white" }}>Goolinext SuperAdmin</p>
						<p style={{ fontSize:11, color:"#475569" }}>Full control panel</p>
					</div>
				</div>
				<a href="/" style={{ fontSize:12, color:"#475569", textDecoration:"none" }}>← Dashboard</a>
			</div>

			<div style={{ maxWidth:1100, margin:"0 auto", padding:"28px 24px" }}>

				{/* Stats */}
				<div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))", gap:12, marginBottom:28 }}>
					{[
						{ label:"Total Negocios", value: s?.totalShops ?? 0, color:"#f97316" },
						{ label:"Activos $150/mo", value: s?.activeShops ?? 0, color:"#10b981" },
						{ label:"En Trial", value: s?.trialShops ?? 0, color:"#f59e0b" },
						{ label:"MRR", value: `$${(s?.mrr ?? 0).toLocaleString()}`, color:"#10b981" },
						{ label:"ARR", value: `$${((s?.mrr ?? 0)*12).toLocaleString()}`, color:"#10b981" },
						{ label:"Total Usuarios", value: s?.totalUsers ?? 0, color:"#94a3b8" },
					].map((stat, i) => (
						<div key={i} style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:"18px 16px" }}>
							<p style={{ fontSize:10, color:"#475569", fontWeight:600, letterSpacing:"0.05em", marginBottom:8 }}>{stat.label.toUpperCase()}</p>
							<p style={{ fontSize:26, fontWeight:800, color:stat.color, lineHeight:1 }}>{stat.value}</p>
						</div>
					))}
				</div>

				{/* Search */}
				<div style={{ marginBottom:16 }}>
					<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by business name or email..."
						style={{ width:"100%", padding:"11px 16px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, color:"white", fontSize:13, outline:"none", fontFamily:"inherit" }} />
				</div>

				{/* Shops table */}
				<div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:18, overflow:"hidden" }}>
					<div style={{ padding:"16px 22px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
						<h2 style={{ fontSize:15, fontWeight:700, color:"white" }}>Todos los Negocios</h2>
						<span style={{ fontSize:12, color:"#475569" }}>{filtered.length} de {data?.shops.length ?? 0}</span>
					</div>
					<div style={{ overflowX:"auto" }}>
						<table style={{ width:"100%", borderCollapse:"collapse" }}>
							<thead>
								<tr style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
									{["Negocio","Owner","Status","Clientes","Visitas","Desde","Acciones"].map((h,i) => (
										<th key={i} style={{ padding:"10px 16px", textAlign:"left", fontSize:10, fontWeight:600, color:"#475569", letterSpacing:"0.05em", whiteSpace:"nowrap" }}>{h.toUpperCase()}</th>
									))}
								</tr>
							</thead>
							<tbody>
								{filtered.map((shop, i) => {
									const date = shop.createdAt ? new Date(shop.createdAt).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"2-digit" }) : "—";
									return (
										<tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}
											onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
											onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
										>
											<td style={{ padding:"12px 16px" }}>
												<p style={{ fontSize:13, fontWeight:600, color:"white" }}>{shop.shopName}</p>
												{shop.address && <p style={{ fontSize:11, color:"#475569", marginTop:1 }}>{shop.address}</p>}
											</td>
											<td style={{ padding:"12px 16px", fontSize:12, color:"#64748b" }}>{shop.ownerEmail ?? "—"}</td>
											<td style={{ padding:"12px 16px" }}><Badge status={shop.status ?? "trial"} /></td>
											<td style={{ padding:"12px 16px", fontSize:13, color:"#94a3b8", textAlign:"center" }}>{shop.clientCount}</td>
											<td style={{ padding:"12px 16px", fontSize:13, color:"#94a3b8", textAlign:"center" }}>{shop.visitCount}</td>
											<td style={{ padding:"12px 16px", fontSize:12, color:"#475569", whiteSpace:"nowrap" }}>{date}</td>
											<td style={{ padding:"12px 16px" }}>
												<button type="button" onClick={() => setSelectedShopId(shop.shopId)}
													style={{ padding:"6px 14px", background:"rgba(249,115,22,0.12)", border:"1px solid rgba(249,115,22,0.25)", borderRadius:8, color:"#f97316", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
													Manage →
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
						{filtered.length === 0 && <div style={{ padding:40, textAlign:"center", color:"#334155", fontSize:14 }}>No results.</div>}
					</div>
				</div>
			</div>

			{selectedShopId && <ShopDetailModal shopId={selectedShopId} onClose={() => setSelectedShopId(null)} />}
		</div>
	);
}
