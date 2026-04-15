from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class TypeFieldBase(BaseModel):
    name: str
    field_type: str
    options: List[str] = []
    keep_on_baixa: bool = False
    required_field: bool = False

class TypeFieldCreate(TypeFieldBase):
    pass

class TypeFieldResp(TypeFieldBase):
    id: int
    part_type_id: int
    class Config:
        from_attributes = True

class PartTypeBase(BaseModel):
    name: str

class PartTypeCreate(PartTypeBase):
    fields: List[TypeFieldCreate] = []

class PartTypeResp(PartTypeBase):
    id: int
    fields: List[TypeFieldResp] = []
    class Config:
        from_attributes = True

class PartBase(BaseModel):
    part_number: str
    location: str
    type_id: int
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[str] = None
    price: Optional[str] = None
    show_price: bool = True
    description: Optional[str] = None
    images: List[str] = []
    dynamic_data: dict = {}

class PartCreate(PartBase):
    pass

class PartResp(PartBase):
    id: int
    status: str
    class Config:
        from_attributes = True

class PartUpdate(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[str] = None
    price: Optional[str] = None
    show_price: Optional[bool] = None
    description: Optional[str] = None
    images: Optional[List[str]] = None
    dynamic_data: Optional[dict] = None

class InquiryBase(BaseModel):
    email: str
    phone: str
    message: str

class InquiryCreate(InquiryBase):
    part_id: Optional[int] = None
    vehicle_id: Optional[int] = None

class InquiryUpdate(BaseModel):
    status: str

class InquiryResp(InquiryBase):
    id: int
    part_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    created_at: datetime
    status: str
    class Config:
        from_attributes = True

class VehicleBase(BaseModel):
    vin: Optional[str] = None
    make: str
    model: str
    year: Optional[str] = None
    vehicle_type: str
    price: Optional[str] = None
    show_price: bool = True
    description: Optional[str] = None
    engine: Optional[str] = None
    mileage: Optional[str] = None
    images: List[str] = []

class VehicleCreate(VehicleBase):
    pass

class VehicleUpdate(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[str] = None
    vehicle_type: Optional[str] = None
    price: Optional[str] = None
    show_price: Optional[bool] = None
    description: Optional[str] = None
    engine: Optional[str] = None
    mileage: Optional[str] = None
    images: Optional[List[str]] = None
    status: Optional[str] = None

class VehicleResp(VehicleBase):
    id: int
    status: str
    class Config:
        from_attributes = True

class BrandCreate(BaseModel):
    name: str

class BrandUpdate(BaseModel):
    name: str

class BrandResp(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class LocationCreate(BaseModel):
    name: str

class LocationUpdate(BaseModel):
    name: str

class LocationResp(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class PartBaixa(BaseModel):
    action: str  # "Sold" or "Removed"
    sale_price: Optional[str] = None

class UserBase(BaseModel):
    username: str
    role: str

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    password: Optional[str] = None
    role: Optional[str] = None

class UserResp(UserBase):
    id: int
    class Config:
        from_attributes = True

class UserMe(UserBase):
    id: int
    class Config:
        from_attributes = True

class PartPaginated(BaseModel):
    total: int
    items: List[PartResp]

class VehiclePaginated(BaseModel):
    total: int
    items: List[VehicleResp]

class UserPaginated(BaseModel):
    total: int
    items: List[UserResp]
