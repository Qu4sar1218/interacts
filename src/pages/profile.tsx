import React, { useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { authService } from "@/services/auth.service"
import { MainLayout } from "@/components/layout/MainLayout"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { getAvatarUrl } from "@/lib/utils"
import { CameraIcon, SaveIcon, KeyRoundIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()

  const fallback = (user ? `${user.firstName} ${user.lastName}` : "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")

  // Profile form state
  const [firstName, setFirstName] = useState(user?.firstName ?? "")
  const [lastName, setLastName] = useState(user?.lastName ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? "")
  const [address, setAddress] = useState(user?.address ?? "")
  const [birthday, setBirthday] = useState(
    user?.birthday ? user.birthday.slice(0, 10) : ""
  )
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const formData = new FormData()
      formData.append("firstName", firstName)
      formData.append("lastName", lastName)
      formData.append("email", email)
      formData.append("phoneNumber", phoneNumber)
      formData.append("address", address)
      if (birthday) formData.append("birthday", birthday)
      if (imageFile) formData.append("image", imageFile)

      await authService.updateProfile(formData)
      await refreshUser()
      setImageFile(null)
      setImagePreview(null)
      toast.success("Profile updated successfully")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update profile"
      toast.error(message)
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }
    setSavingPassword(true)
    try {
      const axiosClient = (await import("@/services/api")).default
      await axiosClient.post("/auth/change-password", { currentPassword, newPassword })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success("Password changed successfully")
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err instanceof Error ? err.message : "Failed to change password")
      toast.error(message)
    } finally {
      setSavingPassword(false)
    }
  }

  const avatarSrc = imagePreview ?? getAvatarUrl(user?.imageUrl)

  return (
    <MainLayout>
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your personal information and account settings.
          </p>
        </div>

        {/* Profile form */}
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Avatar upload */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="h-24 w-24 text-2xl">
                <AvatarImage src={avatarSrc} alt={user?.firstName} />
                <AvatarFallback className="text-2xl">{fallback}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background transition-opacity hover:opacity-90"
                aria-label="Upload profile photo"
              >
                <CameraIcon className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
            {imageFile && (
              <p className="text-xs text-muted-foreground">
                {imageFile.name} &mdash; click Save to apply
              </p>
            )}
          </div>

          {/* Read-only fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input value={user?.username ?? ""} readOnly className="bg-muted" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <div className="flex h-9 items-center">
                <Badge variant="secondary">{user?.role?.name ?? "—"}</Badge>
              </div>
            </div>
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="birthday">Birthday</Label>
              <Input
                id="birthday"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={savingProfile} className="w-full sm:w-auto">
            {savingProfile ? (
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <SaveIcon className="mr-2 h-4 w-4" />
            )}
            Save Profile
          </Button>
        </form>

        <Separator />

        {/* Change password */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <KeyRoundIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-medium">Change Password</h2>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Password must be at least 8 characters and include uppercase, lowercase, number, and special character.
            </p>
            <Button type="submit" variant="outline" disabled={savingPassword} className="w-full sm:w-auto">
              {savingPassword ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRoundIcon className="mr-2 h-4 w-4" />
              )}
              Change Password
            </Button>
          </form>
        </div>
      </div>
    </MainLayout>
  )
}
