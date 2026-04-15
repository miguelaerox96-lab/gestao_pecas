from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="admin") # 'admin', 'staff'

class Brand(Base):
    __tablename__ = "brands"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True) # Full display name e.g. "Secção A - P1"
    section = Column(String, index=True)           # e.g. "A"
    shelf = Column(Integer, index=True)             # e.g. 1
    
    # Optional: ensure unique combination of section and shelf if we want strict grid
    __table_args__ = (UniqueConstraint('section', 'shelf', name='_section_shelf_uc'),)

class PartType(Base):
    __tablename__ = "part_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    fields = relationship("TypeField", back_populates="part_type", cascade="all, delete-orphan")
    parts = relationship("Part", back_populates="part_type")

class TypeField(Base):
    __tablename__ = "type_fields"
    id = Column(Integer, primary_key=True, index=True)
    part_type_id = Column(Integer, ForeignKey("part_types.id"))
    name = Column(String)
    field_type = Column(String) # 'text', 'number', 'options'
    options = Column(JSON, default=list) # list of strings if field_type=='options'
    keep_on_baixa = Column(Boolean, default=False)
    required_field = Column(Boolean, default=False)
    
    part_type = relationship("PartType", back_populates="fields")

class Part(Base):
    __tablename__ = "parts"
    __table_args__ = (UniqueConstraint('part_number', 'type_id', name='_part_number_type_uc'),)
    id = Column(Integer, primary_key=True, index=True)
    part_number = Column(String, index=True)
    location = Column(String, index=True) 
    type_id = Column(Integer, ForeignKey("part_types.id"))
    brand = Column(String, index=True)
    model = Column(String, index=True)
    year = Column(String)
    price = Column(String, nullable=True)
    show_price = Column(Boolean, default=True)
    description = Column(String, nullable=True)
    images = Column(JSON, default=list) # max 5 paths strings
    status = Column(String, default="Available", index=True) # 'Available', 'Sold', 'EmptySlot'
    dynamic_data = Column(JSON, default=dict)
    search_index = Column(String, index=True) # Unified searchable content
    
    part_type = relationship("PartType", back_populates="parts")
    inquiries = relationship("Inquiry", back_populates="part")

class Inquiry(Base):
    __tablename__ = "inquiries"
    id = Column(Integer, primary_key=True, index=True)
    part_id = Column(Integer, ForeignKey("parts.id"), nullable=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    email = Column(String)
    phone = Column(String)
    message = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="New") # 'New', 'Read', 'Replied'
    
    part = relationship("Part", back_populates="inquiries")
    vehicle = relationship("Vehicle", back_populates="inquiries")

class HistoryRecord(Base):
    __tablename__ = "history"
    id = Column(Integer, primary_key=True, index=True)
    part_id = Column(Integer, nullable=True)
    vehicle_id = Column(Integer, nullable=True)
    action = Column(String) # 'Created', 'Sold', 'Restocked', 'Deleted', 'ConfigChanged', etc
    user = Column(String, nullable=True) # Username who performed the action
    timestamp = Column(DateTime, default=datetime.utcnow)
    price_at_action = Column(String, nullable=True)
    details = Column(String, nullable=True)

class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(Integer, primary_key=True, index=True)
    vin = Column(String, nullable=True, index=True)
    make = Column(String, index=True)
    model = Column(String, index=True)
    year = Column(String)
    vehicle_type = Column(String, index=True) # "Salvado" or "Para Peças"
    price = Column(String, nullable=True)
    show_price = Column(Boolean, default=True)
    description = Column(String, nullable=True)
    engine = Column(String, nullable=True)
    mileage = Column(String, nullable=True)
    images = Column(JSON, default=list) # max 5 or more paths
    status = Column(String, default="Available", index=True) # 'Available', 'Sold'
    search_index = Column(String, index=True) # Unified searchable content

    inquiries = relationship("Inquiry", back_populates="vehicle")
