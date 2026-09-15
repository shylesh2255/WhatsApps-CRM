"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

interface ProductFormProps {
  accountId: string;
  product?: {
    id: string;
    name: string;
    description?: string;
    price: number;
    currency: string;
    image_url?: string;
    category?: string;
    sku?: string;
  };
  onSuccess: () => void;
}

export function ProductForm({ accountId, product, onSuccess }: ProductFormProps) {
  const { profile } = useAuth();
  const supabase = createClient();
  const isEdit = !!product;

  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [price, setPrice] = useState(product?.price.toString() || "0");
  const [currency, setCurrency] = useState(product?.currency || "INR");
  const [category, setCategory] = useState(product?.category || "");
  const [sku, setSku] = useState(product?.sku || "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(product?.image_url || "");
  const imageUrl = product?.image_url || "";

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setImageFile(file);

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!profile) return null;

    try {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `products/${accountId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("products")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error("Failed to upload image");
        return null;
      }

      // Get public URL
      const { data } = supabase.storage
        .from("products")
        .getPublicUrl(filePath);

      return data?.publicUrl || null;
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Error uploading image");
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Product name is required");
      return;
    }

    if (!profile) return;

    setIsSubmitting(true);

    try {
      let finalImageUrl = imageUrl;

      // Upload new image if selected
      if (imageFile) {
        const uploadedUrl = await uploadImage(imageFile);
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        }
      }

      const productData = {
        account_id: accountId,
        name: name.trim(),
        description: description.trim() || null,
        price: parseFloat(price) || 0,
        currency: currency || "INR",
        category: category.trim() || null,
        sku: sku.trim() || null,
        image_url: finalImageUrl || null,
        updated_by: profile.id,
      };

      if (isEdit && product) {
        // Update existing product
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", product.id);

        if (error) throw error;
        toast.success("Product updated successfully");
      } else {
        // Create new product
        const { error } = await supabase.from("products").insert([
          {
            ...productData,
            created_by: profile.id,
          },
        ]);

        if (error) throw error;
        toast.success("Product added successfully");
      }

      onSuccess();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Failed to save product");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Image Upload */}
      <div className="border-2 border-dashed rounded-lg p-4">
        {imagePreview ? (
          <div className="relative w-full h-32 mb-2">
            <Image
              src={imagePreview}
              alt="Preview"
              fill
              className="object-contain"
            />
          </div>
        ) : null}
        <label className="cursor-pointer flex flex-col items-center justify-center">
          <Upload className="h-6 w-6 text-muted-foreground mb-2" />
          <span className="text-sm font-medium">Upload Product Photo</span>
          <span className="text-xs text-muted-foreground">
            (Max 5MB)
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
        </label>
      </div>

      {/* Name */}
      <div>
        <Label htmlFor="name">Product Name *</Label>
        <Input
          id="name"
          placeholder="e.g., Cotton Shirt"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Product description..."
          className="resize-none"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      {/* Price & Currency */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="price">Price *</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            placeholder="INR"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <Label htmlFor="category">Category</Label>
        <Input
          id="category"
          placeholder="e.g., Clothing"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      {/* SKU */}
      <div>
        <Label htmlFor="sku">SKU</Label>
        <Input
          id="sku"
          placeholder="e.g., SHIRT-001"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Unique product identifier
        </p>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isSubmitting ? "Saving..." : isEdit ? "Update Product" : "Add Product"}
      </Button>
    </form>
  );
}
