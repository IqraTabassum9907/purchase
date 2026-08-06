"use client";

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Settings as SettingsIcon, Plus, Pencil, Trash2, ShieldAlert, KeyRound, LayoutList, Search } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { STAGES } from "@/lib/constants";
import { useAuth } from "@/lib/auth-context";
import { getErrorMessage } from "@/lib/utils";

// Every page a user could be granted access to — the workflow stages plus
// the Dashboard, which isn't itself a STAGES entry.
const ALL_PAGES = ["Dashboard", ...STAGES.map((s) => s.name)];

interface UserRow {
  id: string;
  username: string;
  full_name: string;
  role: string;
  page_access: string[] | null;
}

const defaultForm = {
  username: "",
  fullName: "",
  password: "",
  role: "User",
  pageAccess: [] as string[],
};

export default function SettingsPage() {
  const { role: myRole } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("users_master")
        .select("id, username, full_name, role, page_access")
        .order("created_at", { ascending: true });
      if (error) throw error;
      setUsers(data || []);
    } catch (e) {
      console.error("Fetch error Settings:", getErrorMessage(e));
      toast.error(`Failed to load users: ${getErrorMessage(e)}`);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (myRole === "Admin") fetchUsers();
  }, [myRole]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [users, searchTerm]);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setForm(defaultForm);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (user: UserRow) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      fullName: user.full_name || "",
      password: "",
      role: user.role || "User",
      pageAccess: user.page_access || [],
    });
    setIsDialogOpen(true);
  };

  const togglePage = (page: string) => {
    setForm((prev) => ({
      ...prev,
      pageAccess: prev.pageAccess.includes(page)
        ? prev.pageAccess.filter((p) => p !== page)
        : [...prev.pageAccess, page],
    }));
  };

  const toggleAllPages = (checked: boolean) => {
    setForm((prev) => ({ ...prev, pageAccess: checked ? [...ALL_PAGES] : [] }));
  };

  const handleSubmit = async () => {
    if (!form.username.trim() || !form.fullName.trim()) {
      toast.error("Username and Full Name are required.");
      return;
    }
    if (!editingUser && !form.password.trim()) {
      toast.error("Password is required for a new login.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingUser) {
        const updatePayload: Record<string, any> = {
          full_name: form.fullName.trim(),
          role: form.role,
          page_access: form.pageAccess,
        };
        // Leave the existing password untouched unless a new one was typed.
        if (form.password.trim()) {
          updatePayload.password_hash = form.password.trim();
        }
        const { error } = await supabase
          .from("users_master")
          .update(updatePayload)
          .eq("id", editingUser.id);
        if (error) throw error;
        toast.success("Login updated successfully.");
      } else {
        const { error } = await supabase.from("users_master").insert({
          username: form.username.trim(),
          password_hash: form.password.trim(),
          full_name: form.fullName.trim(),
          role: form.role,
          page_access: form.pageAccess,
        });
        if (error) throw error;
        toast.success("Login created successfully.");
      }

      setIsDialogOpen(false);
      setForm(defaultForm);
      setEditingUser(null);
      await fetchUsers();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to save login.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("users_master").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success(`Removed login for "${deleteTarget.username}".`);
      setDeleteTarget(null);
      await fetchUsers();
    } catch (e) {
      toast.error(getErrorMessage(e) || "Failed to delete login.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (myRole !== "Admin") {
    return (
      <div className="p-6 h-[calc(100vh-2rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <div className="p-4 bg-red-50 rounded-full text-red-600">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="text-sm text-slate-500">
            Settings manages user logins and page access — only Admins can view this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-6 p-6 bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-700 rounded-lg shadow-slate-100 shadow-xl text-white">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Stage : Settings</h2>
              <p className="text-slate-500 text-sm">Manage logins and per-user page access.</p>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-end gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by username, name, role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            <Button
              onClick={handleOpenAdd}
              className="bg-blue-700 hover:bg-blue-800 text-white flex items-center gap-2 px-5 h-10 rounded-xl shadow-md shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Login
            </Button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="border rounded-lg overflow-auto flex-1 shadow-sm relative">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-200">
            <TableRow className="bg-slate-200 hover:bg-slate-200">
              <TableHead className="font-bold text-slate-700 uppercase text-[11px]">
                <span className="flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> Username</span>
              </TableHead>
              <TableHead className="font-bold text-slate-700 uppercase text-[11px]">Full Name</TableHead>
              <TableHead className="font-bold text-slate-700 uppercase text-[11px]">Role</TableHead>
              <TableHead className="font-bold text-slate-700 uppercase text-[11px]">
                <span className="flex items-center gap-1.5"><LayoutList className="w-3.5 h-3.5" /> Page Access</span>
              </TableHead>
              <TableHead className="font-bold text-slate-700 uppercase text-[11px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-700" />
                    <span className="text-slate-500 font-medium">Loading logins...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-slate-400 font-medium">
                  No logins found.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const access = user.page_access || [];
                const allAccess = access.length === 0 || access.length === ALL_PAGES.length;
                return (
                  <TableRow key={user.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-mono text-sm font-semibold text-slate-900">{user.username}</TableCell>
                    <TableCell className="text-sm text-slate-700">{user.full_name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          user.role === "Admin"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }
                      >
                        {user.role || "User"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {allAccess ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                          All Pages
                        </Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {access.slice(0, 3).map((p) => (
                            <Badge key={p} variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px]">
                              {p}
                            </Badge>
                          ))}
                          {access.length > 3 && (
                            <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[10px]">
                              +{access.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(user)}
                          className="h-8 text-xs font-semibold px-2.5"
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteTarget(user)}
                          className="h-8 text-xs font-semibold px-2.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingUser ? "Edit Login" : "Add New Login"}</DialogTitle>
            <DialogDescription>
              Manage this user&apos;s sign-in credentials and which pages they can see.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 pr-1">
            {/* Login Details */}
            <div className="space-y-4">
              <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> Login Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Username {!editingUser && <span className="text-red-500">*</span>}</Label>
                  <Input
                    value={form.username}
                    disabled={!!editingUser}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    placeholder="e.g. rajesh.k"
                    className={editingUser ? "bg-slate-50 text-slate-500" : ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Full Name <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.fullName}
                    onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                    placeholder="e.g. Rajesh Kumar"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Password {editingUser ? <span className="text-slate-400 font-normal">(leave blank to keep unchanged)</span> : <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder={editingUser ? "••••••••" : "Set a password"}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="User">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Page Access */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <LayoutList className="w-3.5 h-3.5" /> Page Access
                </h4>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={form.pageAccess.length === ALL_PAGES.length}
                    onCheckedChange={(c) => toggleAllPages(!!c)}
                  />
                  <Label className="text-xs font-medium text-slate-600">All Pages</Label>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 -mt-1">
                Leave everything unchecked to grant access to all pages by default.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {ALL_PAGES.map((page) => (
                  <div key={page} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/50">
                    <Checkbox
                      checked={form.pageAccess.includes(page)}
                      onCheckedChange={() => togglePage(page)}
                    />
                    <Label className="text-xs text-slate-700">{page}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-blue-700 hover:bg-blue-800 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingUser ? (
                "Save Changes"
              ) : (
                "Create Login"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this login?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the login for <strong>{deleteTarget?.username}</strong> ({deleteTarget?.full_name}).
              They will no longer be able to sign in. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
